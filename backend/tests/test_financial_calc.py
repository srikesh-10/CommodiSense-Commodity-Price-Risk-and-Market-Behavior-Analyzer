import math
import numpy as np
import sqlite3
import pytest

from app.data.features import log_returns, rolling_vol
from app.data.fetcher import parse_pink_sheet_xml
from app.config import settings

def test_sqlite_data_integrity():
    """Verify stored SQLite values match raw Pink Sheet exactly."""
    xlsx_path = settings.RAW_DATA_DIR / "CMO-Historical-Data-Monthly.xlsx"
    parsed = parse_pink_sheet_xml(xlsx_path)
    records = parsed["records"]
    assert len(records) >= 801
    
    conn = sqlite3.connect(settings.DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT date, close_price FROM monthly_prices WHERE commodity='gold'")
    db_gold = dict(cur.fetchall())
    cur.execute("SELECT date, close_price FROM monthly_prices WHERE commodity='oil'")
    db_oil = dict(cur.fetchall())
    conn.close()
    
    for r in records:
        d = r["date"]
        assert db_gold[d] == r["gold"], f"Gold mismatch on {d}"
        assert db_oil[d] == r["oil"], f"Oil mismatch on {d}"

def test_log_returns_formula():
    """Verify log_return = ln(current / previous) * 100."""
    p = np.array([100.0, 110.0, 99.0])
    r = log_returns(p, as_percent=True)
    assert np.isnan(r[0])
    expected_1 = math.log(110.0 / 100.0) * 100.0
    expected_2 = math.log(99.0 / 110.0) * 100.0
    assert pytest.approx(r[1], rel=1e-5) == expected_1
    assert pytest.approx(r[2], rel=1e-5) == expected_2

def test_monthly_annualized_volatility():
    """Verify monthly rolling volatility uses sqrt(12) and yields reasonable financial %."""
    # Test realistic monthly returns (~2% monthly std)
    returns = np.array([2.0, -1.5, 3.0, 0.5, -2.0, 1.0, 2.5, -0.8, 1.2, 0.0, -1.0, 2.0])
    vol = rolling_vol(returns, window=6, freq="monthly")
    
    # Check that output values are in reasonable percentage ranges (e.g., 5% to 30%, not thousands)
    for v in vol[5:]:
        assert not np.isnan(v)
        assert 1.0 < v < 50.0, f"Unrealistic annualized monthly vol: {v}"

def test_volatility_annualization_factors():
    """Ensure sqrt(12) is used for monthly and sqrt(252) for daily."""
    returns = np.array([1.0, 1.0, 1.0, 2.0, 0.0, 1.0])
    m_vol = rolling_vol(returns, window=4, freq="monthly")
    d_vol = rolling_vol(returns, window=4, freq="daily")
    
    ratio = d_vol[-1] / m_vol[-1]
    expected_ratio = math.sqrt(252) / math.sqrt(12)
    assert pytest.approx(ratio, rel=1e-4) == expected_ratio

