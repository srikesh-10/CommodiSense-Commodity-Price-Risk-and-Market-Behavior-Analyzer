import math
from datetime import date, timedelta
from typing import List, Tuple, Dict
import numpy as np

def business_days(end: date, n: int) -> List[date]:
    out, d = [], end
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return list(reversed(out))

def simulate_series(seed: int, start_price: float, regimes: dict, trans: np.ndarray, jump: float, n: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    keys = list(regimes)
    state = 1  # sideways
    prices = np.empty(n)
    p = start_price
    for i in range(n):
        if i > 0 and rng.random() < 0.03:
            p *= 1 + jump * rng.standard_t(4) / 100  # fat-tail jump shock
        drift, vol = regimes[keys[state]]
        p *= math.exp(drift + vol * rng.standard_normal())
        prices[i] = p
        if rng.random() < 0.02:
            state = int(rng.choice(len(keys), p=trans[state]))
    return prices

def generate_synthetic_data(seed: int = 1337, end_date: date = date(2026, 10, 16), n_days: int = 2600):
    dates = business_days(end_date, n_days)
    trans = np.array([
        [0.985, 0.005, 0.005, 0.005],
        [0.005, 0.985, 0.005, 0.005],
        [0.004, 0.004, 0.988, 0.004],
        [0.010, 0.010, 0.010, 0.970]
    ])
    gold = simulate_series(seed, 1850.0, {
        "bull": (0.00050, 0.007),
        "bear": (-0.00040, 0.009),
        "sideways": (0.00003, 0.005),
        "highvol": (0.0, 0.014)
    }, trans, 0.4, n_days)
    
    oil = simulate_series(seed + 7, 72.0, {
        "bull": (0.00070, 0.016),
        "bear": (-0.00060, 0.020),
        "sideways": (0.00002, 0.013),
        "highvol": (0.0, 0.030)
    }, trans, 1.2, n_days)
    
    return dates, {"gold": gold, "oil": oil}

