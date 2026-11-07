import numpy as np
import pytest
from app.ml.risk import (
    calculate_var_cvar,
    calculate_max_drawdown,
    calculate_annualized_vol,
    calculate_sharpe_ratio,
    compute_risk_block,
    compute_regime_risk_profiles
)
from app.data.features import log_returns
from app.persistence.storage import load_stored_monthly_series

def test_var_cvar_mathematical_properties():
    # 100 observations uniformly from -10% to +10%
    returns = np.linspace(-10.0, 10.0, 101)
    
    # 95% confidence -> 5th percentile
    var_95, cvar_95 = calculate_var_cvar(returns, confidence=0.95)
    var_99, cvar_99 = calculate_var_cvar(returns, confidence=0.99)
    
    # Mathematical rules:
    # 1. VaR(99%) >= VaR(95%)
    assert var_99 >= var_95
    # 2. CVaR(95%) >= VaR(95%) (Expected shortfall is average of tail worse than VaR)
    assert cvar_95 >= var_95
    # 3. CVaR(99%) >= VaR(99%)
    assert cvar_99 >= var_99
    # 4. Values must be non-negative loss percentages
    assert var_95 > 0 and cvar_95 > 0

def test_max_drawdown_calculation():
    # Sequence: 100 -> 150 -> 75 -> 120
    # Peak is 150, trough is 75 -> Drawdown is (75 - 150)/150 = -50%
    closes = np.array([100.0, 150.0, 75.0, 120.0])
    mdd = calculate_max_drawdown(closes)
    assert np.isclose(mdd, -50.0)

def test_sharpe_ratio():
    # Constant 1% monthly return -> 12% annualized return
    # Ann vol = 10%, Risk-free rate = 2.0% -> Sharpe = (12 - 2) / 10 = 1.0
    returns = np.array([1.0] * 12)
    sharpe = calculate_sharpe_ratio(returns, ann_vol=10.0, freq="monthly", rf_annual=2.0)
    assert np.isclose(sharpe, 1.0)

def test_real_data_comparative_risk():
    gold = load_stored_monthly_series("gold")
    oil = load_stored_monthly_series("oil")
    
    g_closes = np.array([r["close"] for r in gold])
    o_closes = np.array([r["close"] for r in oil])
    g_ret = log_returns(g_closes, as_percent=True)
    o_ret = log_returns(o_closes, as_percent=True)
    
    g_risk, _ = compute_risk_block(g_closes, g_ret, confidence=0.95, freq="monthly")
    o_risk, _ = compute_risk_block(o_closes, o_ret, confidence=0.95, freq="monthly")
    
    # Verify Oil is historically more volatile than Gold
    assert o_risk["annual_vol"] > g_risk["annual_vol"]
    assert o_risk["var_95"] > g_risk["var_95"]
    assert o_risk["var_99"] > g_risk["var_99"]
    assert o_risk["cvar_95"] > g_risk["cvar_95"]
    
    # Verify Gold historical max drawdown exists and is negative
    assert g_risk["max_drawdown"] < 0
    assert o_risk["max_drawdown"] < 0
    
    # Check multi-confidence metrics exist in response
    assert "var_95" in g_risk and "var_99" in g_risk
    assert "cvar_95" in g_risk and "cvar_99" in g_risk
    assert "risk_free_rate" in g_risk

def test_regime_risk_profiles():
    # 3 mock states
    states = np.array([0]*30 + [1]*30 + [2]*30)
    # state 0: calm, state 1: crisis, state 2: bull
    returns = np.concatenate([
        np.random.normal(0.5, 1.0, 30),
        np.random.normal(-3.0, 6.0, 30),
        np.random.normal(2.0, 2.0, 30)
    ])
    profiles = compute_regime_risk_profiles(states, returns, freq="monthly")
    assert len(profiles) == 3
    # Crisis state (state 1) should have highest volatility and VaR
    assert profiles[1]["annual_vol"] > profiles[0]["annual_vol"]
    assert profiles[1]["var_95"] > profiles[0]["var_95"]

