import numpy as np
import pytest
from app.data.features import log_returns, rolling_vol
from app.ml.hmm import run_hmm_em, viterbi_decode, describe_states
from app.persistence.storage import load_stored_monthly_series

def test_hmm_on_real_data():
    gold = load_stored_monthly_series("gold")
    g_closes = np.array([r["close"] for r in gold])
    g_ret = log_returns(g_closes, as_percent=True)
    g_vol = rolling_vol(g_ret, window=12, freq="monthly")
    
    # 2D observations: [monthly_return, rolling_volatility]
    obs = np.column_stack([
        np.nan_to_num(g_ret),
        np.nan_to_num(g_vol)
    ])
    n = len(g_closes)
    assert obs.shape == (n, 2)
    assert np.all(np.isfinite(obs))
    
    k = 3
    fit = run_hmm_em(obs, k=k, iters=50, cov_type="full", seed=42)
    assert fit is not None
    
    # 1. Parameter shapes and validity
    assert fit["mu"].shape == (k, 2)
    assert fit["covs"].shape == (k, 2, 2)
    assert fit["trans"].shape == (k, k)
    assert fit["pi"].shape == (k,)
    assert fit["gamma"].shape == (n, k)
    
    # 2. Probability distribution sanity
    assert np.allclose(fit["pi"].sum(), 1.0, atol=1e-4)
    assert np.allclose(fit["trans"].sum(axis=1), 1.0, atol=1e-4)
    assert np.allclose(fit["gamma"].sum(axis=1), 1.0, atol=1e-4)
    assert np.all(fit["trans"] >= 0.0)
    assert np.all(fit["gamma"] >= 0.0)
    assert np.isfinite(fit["loglike"])
    
    # 3. Viterbi decoding
    viterbi_path = fit["viterbi_states"]
    assert len(viterbi_path) == n
    assert set(np.unique(viterbi_path)).issubset(set(range(k)))
    
    # 4. State characterization
    descriptions = describe_states(viterbi_path, g_ret, g_vol, k)
    assert len(descriptions) == k
    total_share = sum(d["share"] for d in descriptions)
    assert pytest.approx(total_share, rel=1e-2) == 1.0
    for d in descriptions:
        assert "regime_type" in d
        assert "volatility" in d
        assert "mean_return" in d

