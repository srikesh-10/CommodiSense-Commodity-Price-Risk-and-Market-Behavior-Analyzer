import numpy as np
from fastapi import APIRouter, Body
from typing import Dict, Any, List

from app.data.manager import market_manager
from app.data.features import slice_period, scale_features, log_returns
from app.ml.clustering import run_pca, run_kmeans, run_gmm, run_hierarchical, compute_dendrogram, compute_metrics
from app.ml.hmm import run_hmm_em
from app.ml.risk import compute_risk_block
from app.persistence.storage import get_recent_experiments, save_experiment

router = APIRouter(prefix="/api", tags=["Models"])

def extract_features(body: Dict[str, Any]):
    mgr = market_manager
    period = body.get("period", "1y")
    commodities = body.get("commodities", ["gold", "oil"])
    features = body.get("features", ["log_return", "rolling_vol_20"])
    
    mgr_dates = mgr.synthetic_dates
    i0 = slice_period(mgr_dates, period)
    
    feature_dict = {
        "log_return": lambda c: mgr.synthetic_ret[c] * 100.0,
        "rolling_vol_20": lambda c: mgr.synthetic_vol[c],
        "momentum_20": lambda c: mgr.synthetic_mom[c],
        "range_pct": lambda c: mgr.synthetic_rng_pct[c]
    }
    cols = []
    for f in features:
        if f in feature_dict:
            for c in commodities:
                cols.append(np.nan_to_num(feature_dict[f](c)[i0:]))
    if not cols:
        cols.append(np.nan_to_num(mgr.synthetic_ret["gold"][i0:] * 100.0))
        
    X = scale_features(np.column_stack(cols), body.get("scaling", "standard"))
    proj, ratios, _ = run_pca(X, min(3, X.shape[1]))
    return proj, ratios, i0

@router.post("/models/kmeans/run")
def api_kmeans(body: Dict[str, Any] = Body(...)):
    proj, ratios, _ = extract_features(body)
    k = int(body.get("n_clusters", 3))
    seed = int(body.get("random_state", 42))
    labels, centers, inertia = run_kmeans(proj, k, seed)
    metrics = compute_metrics(proj, labels, ["silhouette"])
    return {
        "algorithm": "kmeans",
        "labels": labels.tolist(),
        "explained_variance": ratios,
        "inertia": round(inertia, 2),
        "silhouette": metrics.get("silhouette", 0.0)
    }

@router.post("/models/gmm/run")
def api_gmm(body: Dict[str, Any] = Body(...)):
    proj, ratios, _ = extract_features(body)
    k = int(body.get("n_clusters", 3))
    seed = int(body.get("random_state", 42))
    labels, centers, _, ll, _ = run_gmm(proj, k, seed, 100)
    return {
        "algorithm": "gmm",
        "labels": labels.tolist(),
        "explained_variance": ratios,
        "log_likelihood": round(float(ll), 2)
    }

@router.post("/models/hierarchical/run")
def api_hierarchical(body: Dict[str, Any] = Body(...)):
    proj, ratios, _ = extract_features(body)
    k = int(body.get("n_clusters", 3))
    labels, centers = run_hierarchical(proj, k)
    dendro = compute_dendrogram(proj, k)
    return {
        "algorithm": "hierarchical",
        "labels": labels.tolist(),
        "explained_variance": ratios,
        "dendrogram": dendro
    }

@router.post("/models/pca/run")
def api_pca(body: Dict[str, Any] = Body(...)):
    _, ratios, _ = extract_features(body)
    return {
        "explained_variance": ratios,
        "n_components": len(ratios)
    }

@router.post("/models/hmm/fit")
def api_hmm_fit(body: Dict[str, Any] = Body(...)):
    mgr = market_manager
    i0 = slice_period(mgr.synthetic_dates, body.get("period", "1y"))
    obs = np.column_stack([np.nan_to_num(mgr.synthetic_ret["gold"][i0:]) * 100.0, np.nan_to_num(mgr.synthetic_vol["gold"][i0:])])
    k = int(body.get("n_states", 3))
    fit = run_hmm_em(obs, k, int(body.get("n_iter", 100)), body.get("covariance_type", "full"), int(body.get("random_state", 42)))
    if fit is None:
        return {"error": "insufficient data"}
    return {"log_likelihood": round(float(fit["loglike"]), 2), "n_states": k}

@router.post("/models/hmm/infer")
def api_hmm_infer(body: Dict[str, Any] = Body(...)):
    mgr = market_manager
    i0 = slice_period(mgr.synthetic_dates, body.get("period", "1y"))
    obs = np.column_stack([np.nan_to_num(mgr.synthetic_ret["gold"][i0:]) * 100.0, np.nan_to_num(mgr.synthetic_vol["gold"][i0:])])
    k = int(body.get("n_states", 3))
    fit = run_hmm_em(obs, k, 50, "full", int(body.get("random_state", 42)))
    if fit is None:
        return {"error": "insufficient data"}
    states = fit["gamma"].argmax(1)
    return {"states": states.tolist(), "transition_matrix": [[round(float(v), 4) for v in row] for row in fit["trans"]]}

@router.get("/risk/summary")
@router.post("/risk/summary")
def api_risk_summary(body: Dict[str, Any] = Body(default={})):
    mgr = market_manager
    period = body.get("period", "all")
    interval = body.get("interval", "monthly")
    
    if interval == "monthly" and mgr.real_metadata and mgr.real_monthly_dates:
        mgr_dates = mgr.real_monthly_dates
        mgr_prices = mgr.real_monthly_prices
        freq_str = "monthly"
    else:
        mgr_dates = mgr.synthetic_dates
        mgr_prices = mgr.synthetic_prices
        freq_str = "daily"
        
    i0 = slice_period(mgr_dates, period)
    ret_g = log_returns(mgr_prices["gold"][i0:], as_percent=True)
    ret_o = log_returns(mgr_prices["oil"][i0:], as_percent=True)
    
    conf = float(body.get("var_confidence", 0.95))
    window = int(body.get("vol_window", 12))
    sens = body.get("sensitivity", "balanced")
    
    blk_g, th = compute_risk_block(mgr_prices["gold"][i0:], ret_g, conf, window, sens, freq=freq_str)
    blk_o, _ = compute_risk_block(mgr_prices["oil"][i0:], ret_o, conf, window, sens, freq=freq_str)
    
    return {
        "gold": blk_g,
        "oil": blk_o,
        "thresholds": th
    }

@router.get("/models/experiments")
@router.post("/models/experiments")
def api_experiments(body: Dict[str, Any] = Body(default={})):
    persisted = get_recent_experiments(limit=10)
    if persisted:
        return {"experiments": persisted}
    proj, _, _ = extract_features(body)
    seed = int(body.get("random_state", 42))
    exps = []
    for k in (2, 3, 4, 5):
        lab, _, _ = run_kmeans(proj, k, seed)
        m = compute_metrics(proj, lab, ["silhouette"])
        sil = m.get("silhouette", 0.0)
        exp_item = {
            "id": f"exp-kmeans-{k}",
            "algorithm": "kmeans",
            "n_clusters": k,
            "silhouette": sil
        }
        save_experiment(exp_item["id"], "kmeans", k, sil, {})
        exps.append(exp_item)
    return {"experiments": exps}

