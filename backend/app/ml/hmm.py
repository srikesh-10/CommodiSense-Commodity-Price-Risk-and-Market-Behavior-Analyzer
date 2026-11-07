import math
import numpy as np
from typing import Optional, Dict, Any, List, Tuple

def viterbi_decode(obs: np.ndarray, pi: np.ndarray, trans: np.ndarray, mu: np.ndarray, covs: np.ndarray, cov_type: str = "full") -> np.ndarray:
    """Computes most probable sequence of hidden states using Viterbi algorithm in log space."""
    n, d = obs.shape
    k = len(pi)
    
    # Precompute log emission probabilities
    logb = np.empty((n, k))
    for j in range(k):
        s = covs[j]
        if cov_type == "spherical":
            s = np.mean(np.diag(covs[j])) * np.eye(d)
        elif cov_type == "diag":
            s = np.diag(np.diag(covs[j]))
        s = s + np.eye(d) * 1e-5
        inv = np.linalg.inv(s)
        diff = obs - mu[j]
        logb[:, j] = -0.5 * (np.log(np.linalg.det(s)) + d * math.log(2 * math.pi) + ((diff @ inv) * diff).sum(1))
        
    log_pi = np.log(np.maximum(pi, 1e-12))
    log_trans = np.log(np.maximum(trans, 1e-12))
    
    viterbi = np.empty((n, k))
    backpointer = np.empty((n, k), dtype=int)
    
    viterbi[0] = log_pi + logb[0]
    
    for t in range(1, n):
        for j in range(k):
            trans_probs = viterbi[t - 1] + log_trans[:, j]
            best_prev = np.argmax(trans_probs)
            viterbi[t, j] = trans_probs[best_prev] + logb[t, j]
            backpointer[t, j] = best_prev
            
    best_path = np.empty(n, dtype=int)
    best_path[-1] = np.argmax(viterbi[-1])
    for t in range(n - 2, -1, -1):
        best_path[t] = backpointer[t + 1, best_path[t + 1]]
        
    return best_path

def describe_states(states: np.ndarray, returns: np.ndarray, vols: np.ndarray, k: int) -> List[Dict[str, Any]]:
    """Calculates factual statistical characteristics for each inferred hidden state.
    Labels states objectively based on measured mean returns and volatility.
    """
    stats = []
    for s_idx in range(k):
        mask = states == s_idx
        n_in_state = int(mask.sum())
        sub_r = returns[mask]
        sub_v = vols[mask]
        
        mean_ret = float(np.mean(sub_r)) if n_in_state else 0.0
        ann_vol = float(np.std(sub_r) * math.sqrt(12)) if n_in_state > 1 else (float(np.mean(sub_v)) if n_in_state else 0.0)
        share = float(n_in_state / len(states)) if len(states) else 0.0
        
        # Objective, measured description without ungrounded speculation
        regime_type = "High Volatility" if ann_vol > 25.0 else ("Positive Trend" if mean_ret > 1.0 else ("Negative Trend" if mean_ret < -1.0 else "Stable / Sideways"))
        
        stats.append({
            "state": s_idx,
            "observations": n_in_state,
            "share": round(share, 3),
            "mean_return": round(mean_ret, 3),
            "volatility": round(ann_vol, 2),
            "regime_type": regime_type
        })
    return stats

def run_hmm_em(x: np.ndarray, k: int, iters: int = 100, cov_type: str = "full", seed: int = 42) -> Optional[Dict[str, Any]]:
    """Runs Baum-Welch (EM) parameter estimation for Gaussian Hidden Markov Model."""
    rng = np.random.default_rng(seed)
    n, d = x.shape
    if n < k * 3:
        return None
    
    # Deterministic kmeans-like initialization
    indices = rng.choice(n, size=k, replace=False)
    mu = x[indices].copy()
    
    diffs = np.linalg.norm(x[:, None, :] - mu[None, :, :], axis=2)
    labels = np.argmin(diffs, axis=1)
    
    covs = np.array([
        np.cov(x[labels == j].T) if (labels == j).sum() > d else np.eye(d)
        for j in range(k)
    ]) + np.eye(d) * 1e-3
    if covs.shape == (k,):
        covs = covs.reshape(k, 1, 1)
        
    pi = np.full(k, 1.0 / k)
    trans = np.full((k, k), 0.1)
    np.fill_diagonal(trans, 0.8)
    trans /= trans.sum(1, keepdims=True)
    
    prev_ll = -np.inf
    gamma = np.zeros((n, k))
    loglike = 0.0
    
    for _ in range(max(2, iters)):
        logb = np.empty((n, k))
        try:
            for j in range(k):
                if cov_type == "spherical":
                    s = np.mean(np.diag(covs[j])) * np.eye(d)
                elif cov_type == "diag":
                    s = np.diag(np.diag(covs[j]))
                else:
                    s = covs[j]
                s = s + np.eye(d) * 1e-5
                inv = np.linalg.inv(s)
                diff = x - mu[j]
                logb[:, j] = -0.5 * (np.log(np.linalg.det(s)) + d * math.log(2 * math.pi) + ((diff @ inv) * diff).sum(1))
        except np.linalg.LinAlgError:
            return None
            
        scale = np.empty(n)
        A = trans.copy()
        B = np.exp(logb - logb.max(1, keepdims=True))
        g = pi * B[0]
        scale[0] = g.sum()
        if scale[0] <= 0:
            return None
        g = g / scale[0]
        gamma[0] = g
        xi_sum = np.zeros((k, k))
        alphas = [g]
        for t in range(1, n):
            g = (alphas[-1] @ A) * B[t]
            s_ = g.sum()
            if s_ <= 0:
                return None
            scale[t] = s_
            g = g / s_
            gamma[t] = g
            alphas.append(g)
        loglike = float(np.log(scale).sum())
        
        betas = [np.ones(k)]
        for t in range(n - 2, -1, -1):
            b_next = (A * B[t + 1] * betas[0]) @ np.ones(k)
            s_ = b_next.sum()
            b_next = b_next / (s_ + 1e-300)
            betas.insert(0, b_next)
            
        for t in range(n - 1):
            xi = (alphas[t][:, None] * A * (B[t + 1] * betas[n - 1 - t])[None, :])
            s_ = xi.sum()
            if s_ > 0:
                xi_sum += xi / s_
        trans = np.maximum(xi_sum, 1e-8)
        trans /= trans.sum(1, keepdims=True)
        pi = gamma[0] + 1e-8
        pi /= pi.sum()
        w = gamma.sum(0) + 1e-8
        mu = (gamma.T @ x) / w[:, None]
        for j in range(k):
            diff = x - mu[j]
            covs[j] = (gamma[:, j][:, None] * diff).T @ diff / w[j] + np.eye(d) * 1e-4
            if cov_type == "diag":
                covs[j] = np.diag(np.diag(covs[j]))
            elif cov_type == "spherical":
                covs[j] = np.mean(np.diag(covs[j])) * np.eye(d)
                
        if abs(loglike - prev_ll) < 1e-3:
            break
        prev_ll = loglike

    # Run Viterbi algorithm to decode state path
    viterbi_states = viterbi_decode(x, pi, trans, mu, covs, cov_type)

    return {
        "mu": mu,
        "covs": covs,
        "trans": trans,
        "pi": pi,
        "gamma": gamma,
        "viterbi_states": viterbi_states,
        "loglike": loglike,
    }
