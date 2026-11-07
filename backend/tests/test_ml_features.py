import numpy as np
import pytest
from app.data.features import (
    log_returns, moving_average, rolling_vol, momentum, price_range_pct, rolling_corr, scale_features
)

def test_features_on_real_data():
    from app.persistence.storage import load_stored_monthly_series
    gold = load_stored_monthly_series("gold")
    oil = load_stored_monthly_series("oil")
    
    g_closes = np.array([r["close"] for r in gold])
    o_closes = np.array([r["close"] for r in oil])
    n = len(g_closes)
    assert n >= 801
    assert len(o_closes) == n
    
    # 1. Log returns
    g_ret = log_returns(g_closes, as_percent=True)
    o_ret = log_returns(o_closes, as_percent=True)
    assert len(g_ret) == n
    assert np.isnan(g_ret[0])
    assert not np.isnan(g_ret[1])
    
    # 2. Moving average
    g_ma12 = moving_average(g_closes, window=12)
    assert np.isnan(g_ma12[10])
    assert not np.isnan(g_ma12[11])
    assert np.isclose(g_ma12[11], np.mean(g_closes[:12]))
    
    # 3. Rolling volatility (monthly)
    g_vol = rolling_vol(g_ret, window=12, freq="monthly")
    assert not np.isnan(g_vol[-1])
    assert 5.0 < g_vol[-1] < 100.0  # realistic volatility range
    
    # 4. Momentum
    g_mom = momentum(g_closes, window=12)
    assert np.isnan(g_mom[11])
    assert not np.isnan(g_mom[12])
    expected_mom = (g_closes[12] / g_closes[0] - 1.0) * 100.0
    assert np.isclose(g_mom[12], expected_mom)
    
    # 5. Price range
    g_rng = price_range_pct(g_closes, window=12)
    assert not np.isnan(g_rng[11])
    assert g_rng[11] >= 0.0
    
    # 6. Rolling correlation
    corr = rolling_corr(g_ret, o_ret, window=12)
    assert -1.0 <= corr[-1] <= 1.0
    
    # 7. Scaling
    feat_matrix = np.column_stack([
        np.nan_to_num(g_ret),
        np.nan_to_num(g_vol),
        np.nan_to_num(g_mom),
        np.nan_to_num(corr)
    ])
    scaled = scale_features(feat_matrix, method="standard")
    assert scaled.shape == feat_matrix.shape
    assert np.all(np.isfinite(scaled))
    assert np.allclose(scaled.mean(axis=0), 0.0, atol=1e-5)

