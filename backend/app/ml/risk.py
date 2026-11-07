import math
import numpy as np
from typing import Dict, Any, Tuple, Optional, List

# Standard benchmark risk-free rate assumption: 2.5% annualized (long-term US Treasury historical proxy)
ANNUAL_RISK_FREE_RATE = 2.5

def calculate_var_cvar(returns: np.ndarray, confidence: float = 0.95) -> Tuple[float, float]:
    """Calculates historical Value at Risk (VaR) and Conditional VaR (Expected Shortfall).
    
    Parameters:
      returns: return series in percentage form (e.g. -5.2%).
      confidence: confidence level, typically 0.95 or 0.99.
      
    Returns:
      (var, cvar): positive percentage numbers representing loss magnitudes.
    """
    clean_r = returns[~np.isnan(returns)]
    if len(clean_r) < 5:
        return 0.0, 0.0
        
    alpha = (1.0 - confidence) * 100.0
    cutoff = np.percentile(clean_r, alpha)
    tail = clean_r[clean_r <= cutoff]
    cvar_val = float(tail.mean()) if len(tail) else cutoff
    
    # Return as positive percentage loss numbers
    var = round(float(-cutoff), 2)
    cvar = round(float(-cvar_val), 2)
    return max(0.0, var), max(0.0, cvar)

def calculate_max_drawdown(closes: np.ndarray) -> float:
    """Calculates peak-to-trough maximum drawdown in percentage."""
    if len(closes) < 2:
        return 0.0
    peaks = np.maximum.accumulate(closes)
    dd = (closes - peaks) / np.maximum(peaks, 1e-9) * 100.0
    return round(float(dd.min()), 2)

def calculate_annualized_vol(returns: np.ndarray, freq: str = "monthly") -> float:
    """Calculates annualized volatility in percentage."""
    clean_r = returns[~np.isnan(returns)]
    if len(clean_r) < 2:
        return 0.0
    is_pct = np.nanmax(np.abs(clean_r)) > 1.0
    std = float(np.std(clean_r, ddof=1))
    std_pct = std if is_pct else std * 100.0
    ann_factor = math.sqrt(12) if freq == "monthly" else math.sqrt(252)
    return round(std_pct * ann_factor, 2)

def calculate_sharpe_ratio(returns: np.ndarray, ann_vol: float, freq: str = "monthly", rf_annual: float = ANNUAL_RISK_FREE_RATE) -> float:
    """Calculates annualized Sharpe Ratio.
    
    Formula: (Annualized Return - Annualized Risk Free Rate) / Annualized Volatility
    """
    clean_r = returns[~np.isnan(returns)]
    if len(clean_r) < 2 or ann_vol <= 0:
        return 0.0
    # Returns should already be in percentage form; if in decimal form (all < 0.35), scale by 100
    is_dec = np.nanmax(np.abs(clean_r)) <= 0.35
    mean_ret = float(clean_r.mean())
    mean_pct = mean_ret * 100.0 if is_dec else mean_ret
    
    periods_per_year = 12 if freq == "monthly" else 252
    ann_ret = mean_pct * periods_per_year
    excess_ret = ann_ret - rf_annual
    return round(float(excess_ret / ann_vol), 2)

def compute_risk_block(
    closes: np.ndarray,
    returns: np.ndarray,
    confidence: float = 0.95,
    window: int = 12,
    sensitivity: str = "balanced",
    freq: str = "monthly",
    rf_annual: float = ANNUAL_RISK_FREE_RATE
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """Comprehensive risk computation preserving existing schema while adding multi-confidence metrics."""
    clean_r = returns[~np.isnan(returns)]
    if len(clean_r) < 5:
        return {
            "max_drawdown": 0.0, "var": 0.0, "cvar": 0.0, "annual_vol": 0.0, "sharpe": 0.0,
            "var_95": 0.0, "cvar_95": 0.0, "var_99": 0.0, "cvar_99": 0.0, "risk_free_rate": rf_annual
        }, {}

    # Calculate VaR and CVaR at specified confidence
    var, cvar = calculate_var_cvar(clean_r, confidence=confidence)
    # Also pre-calculate 95% and 99% benchmarks
    var_95, cvar_95 = calculate_var_cvar(clean_r, confidence=0.95)
    var_99, cvar_99 = calculate_var_cvar(clean_r, confidence=0.99)
    
    max_dd = calculate_max_drawdown(closes)
    ann_vol = calculate_annualized_vol(clean_r, freq=freq)
    sharpe = calculate_sharpe_ratio(clean_r, ann_vol, freq=freq, rf_annual=rf_annual)
    
    mult = {"conservative": 1.25, "balanced": 1.0, "aggressive": 0.8}.get(sensitivity, 1.0)
    
    thresholds = {
        "var_cutoff": round(float(var * mult), 2),
        "vol_alert": round(ann_vol * 1.15, 2),
        "drawdown_limit": -15.0 if sensitivity == "conservative" else -25.0,
    }
    
    block = {
        "max_drawdown": max_dd,
        "var": var,
        "cvar": cvar,
        "annual_vol": ann_vol,
        "sharpe": sharpe,
        "var_95": var_95,
        "cvar_95": cvar_95,
        "var_99": var_99,
        "cvar_99": cvar_99,
        "risk_free_rate": rf_annual
    }
    return block, thresholds

def compute_regime_risk_profiles(
    states: np.ndarray,
    returns: np.ndarray,
    freq: str = "monthly",
    rf_annual: float = ANNUAL_RISK_FREE_RATE
) -> List[Dict[str, Any]]:
    """Calculates risk profile (VaR 95/99, CVaR, Vol, Sharpe) for each detected market state."""
    profiles = []
    unique_states = np.unique(states)
    for s in unique_states:
        mask = states == s
        sub_r = returns[mask]
        clean_sub = sub_r[~np.isnan(sub_r)]
        n_obs = len(clean_sub)
        
        if n_obs < 5:
            profiles.append({
                "state": int(s),
                "observations": n_obs,
                "note": "Insufficient observations for robust risk statistics"
            })
            continue
            
        var_95, cvar_95 = calculate_var_cvar(clean_sub, confidence=0.95)
        var_99, cvar_99 = calculate_var_cvar(clean_sub, confidence=0.99)
        vol = calculate_annualized_vol(clean_sub, freq=freq)
        sharpe = calculate_sharpe_ratio(clean_sub, vol, freq=freq, rf_annual=rf_annual)
        
        profiles.append({
            "state": int(s),
            "observations": n_obs,
            "annual_vol": vol,
            "var_95": var_95,
            "cvar_95": cvar_95,
            "var_99": var_99,
            "cvar_99": cvar_99,
            "sharpe": sharpe
        })
    return profiles
