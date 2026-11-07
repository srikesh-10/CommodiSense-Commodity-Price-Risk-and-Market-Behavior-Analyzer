import math
import numpy as np
from datetime import date, timedelta
from typing import List, Tuple, Dict, Any, Optional

PERIOD_MONTHS = {"1m": 1, "3m": 3, "6m": 6, "1y": 12, "5y": 60, "all": None}
PERIOD_DAYS = {"1m": 31, "3m": 92, "6m": 183, "1y": 365, "5y": 1826, "all": None}

def log_returns(p: np.ndarray, as_percent: bool = False) -> np.ndarray:
    """Computes logarithmic returns: ln(p_t / p_{t-1}).
    If as_percent is True, multiplies by 100.
    """
    ret = np.diff(np.log(p), prepend=np.nan)
    return ret * 100.0 if as_percent else ret

def moving_average(p: np.ndarray, window: int = 12) -> np.ndarray:
    """Computes rolling simple moving average of price."""
    out = np.full_like(p, np.nan)
    for i in range(window - 1, len(p)):
        out[i] = float(np.nanmean(p[i - window + 1: i + 1]))
    return out

def rolling_vol(r: np.ndarray, window: int = 12, is_annualized: bool = True, freq: str = "monthly") -> np.ndarray:
    """Computes rolling sample standard deviation of returns as percentage.
    freq='monthly' uses sqrt(12), freq='daily' uses sqrt(252).
    """
    out = np.full_like(r, np.nan)
    valid = r[~np.isnan(r)]
    is_pct = np.nanmax(np.abs(valid)) > 1.0 if len(valid) else False
    
    ann_factor = math.sqrt(12) if freq == "monthly" else math.sqrt(252)
    mult = ann_factor if is_annualized else 1.0
    
    for i in range(window - 1, len(r)):
        w = r[i - window + 1: i + 1]
        w = w[~np.isnan(w)]
        if len(w) >= max(3, window // 2):
            std = float(np.nanstd(w, ddof=1)) if len(w) > 1 else float(np.nanstd(w))
            std_pct = std if is_pct else std * 100.0
            out[i] = std_pct * mult
    return out

def momentum(p: np.ndarray, window: int = 12) -> np.ndarray:
    """Computes rate of change momentum: (p_t / p_{t-window} - 1) * 100."""
    out = np.full_like(p, np.nan)
    out[window:] = (p[window:] / p[:-window] - 1.0) * 100.0
    return out

def price_range_pct(p: np.ndarray, window: int = 12) -> np.ndarray:
    """Computes rolling relative price range: (rolling_max - rolling_min) / rolling_mean * 100.
    Supported on single-observation series without synthetic approximations.
    """
    out = np.full_like(p, np.nan)
    for i in range(window - 1, len(p)):
        w = p[i - window + 1: i + 1]
        mean_val = np.mean(w)
        if mean_val > 0:
            out[i] = ((np.max(w) - np.min(w)) / mean_val) * 100.0
    return out

# Backward-compatible alias for existing imports
range_pct = price_range_pct

def rolling_corr(a: np.ndarray, b: np.ndarray, window: int = 12) -> np.ndarray:
    """Computes rolling Pearson correlation between two return series."""
    out = np.full_like(a, np.nan)
    for i in range(window - 1, len(a)):
        x, y = a[i - window + 1: i + 1], b[i - window + 1: i + 1]
        m = ~(np.isnan(x) | np.isnan(y))
        if m.sum() >= max(3, int(window * 0.7)):
            xs, ys = x[m], y[m]
            if xs.std() > 0 and ys.std() > 0:
                out[i] = float(np.corrcoef(xs, ys)[0, 1])
    return out

def scale_features(x: np.ndarray, method: str = "standard") -> np.ndarray:
    """Scales feature matrix with standard (z-score), minmax, or robust scaling.
    Safely handles division by zero and replaces NaNs with column medians/zeros.
    """
    x = x.copy()
    # Impute NaNs with column median or 0.0
    for col_idx in range(x.shape[1]):
        col = x[:, col_idx]
        nan_mask = np.isnan(col)
        if nan_mask.any():
            median_val = np.nanmedian(col) if not np.all(nan_mask) else 0.0
            col[nan_mask] = median_val
            
    if method == "minmax":
        lo, hi = x.min(0), x.max(0)
        rng = np.where(hi - lo == 0, 1.0, hi - lo)
        return (x - lo) / rng
    if method == "robust":
        med = np.median(x, 0)
        iqr = np.subtract(*np.percentile(x, [75, 25], axis=0))
        iqr = np.where(iqr == 0, 1.0, iqr)
        return (x - med) / iqr
        
    mu, sd = x.mean(0), x.std(0)
    sd = np.where(sd == 0, 1.0, sd)
    return (x - mu) / sd

def slice_period(dates: List[date], period: str) -> int:
    days = PERIOD_DAYS.get(period)
    if days is None:
        return 0
    cutoff = dates[-1] - timedelta(days=days)
    for i, d in enumerate(dates):
        if d >= cutoff:
            return i
    return 0

def aggregate_interval(dates: List[date], closes: np.ndarray, interval: str) -> Tuple[List[date], np.ndarray]:
    if interval == "daily":
        return dates, closes
    keys = [d.strftime("%G-W%V") if interval == "weekly" else d.strftime("%Y-%m") for d in dates]
    last: Dict[str, int] = {}
    for i, k in enumerate(keys):
        last[k] = i
    idx = sorted(last.values())
    return [dates[i] for i in idx], closes[idx]
