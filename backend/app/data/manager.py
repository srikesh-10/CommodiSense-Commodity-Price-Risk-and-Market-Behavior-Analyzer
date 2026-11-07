import time
from datetime import date, datetime
from typing import Dict, List, Any, Optional
import numpy as np

from app.config import settings
from app.data.synthetic import generate_synthetic_data
from app.data.fetcher import download_pink_sheet, parse_pink_sheet_xml
from app.data.features import (
    log_returns, rolling_vol, momentum, range_pct, rolling_corr,
    aggregate_interval, slice_period, scale_features
)
from app.persistence.storage import (
    store_monthly_commodity_data, get_monthly_dataset_metadata, load_stored_monthly_series
)

class MarketDataManager:
    def __init__(self):
        self.last_refresh_time: float = time.time()
        
        # Real monthly series loaded from SQLite / Pink Sheet
        self.real_monthly_dates: List[date] = []
        self.real_monthly_prices: Dict[str, np.ndarray] = {}
        self.real_metadata: Optional[Dict[str, Any]] = None
        
        # Synthetic daily/weekly series (clearly marked fallback/calibration)
        self.synthetic_dates: List[date] = []
        self.synthetic_prices: Dict[str, np.ndarray] = {}
        self.synthetic_ret: Dict[str, np.ndarray] = {}
        self.synthetic_vol: Dict[str, np.ndarray] = {}
        self.synthetic_mom: Dict[str, np.ndarray] = {}
        self.synthetic_rng_pct: Dict[str, np.ndarray] = {}
        self.synthetic_corr_roll: np.ndarray = np.array([])
        
        self.source_kind: str = "demo"
        self.provider_name: str = "synthetic-preloaded"
        
        self.initialize_data()

    def initialize_data(self):
        # 1. Initialize synthetic daily fallback data
        self.synthetic_dates, self.synthetic_prices = generate_synthetic_data(
            seed=settings.SEED,
            end_date=date(2026, 10, 16),
            n_days=2600
        )
        for c in ("gold", "oil"):
            self.synthetic_ret[c] = log_returns(self.synthetic_prices[c])
            self.synthetic_vol[c] = rolling_vol(self.synthetic_ret[c])
            self.synthetic_mom[c] = momentum(self.synthetic_prices[c])
            self.synthetic_rng_pct[c] = range_pct(self.synthetic_prices[c])
        self.synthetic_corr_roll = rolling_corr(self.synthetic_ret["gold"], self.synthetic_ret["oil"])

        # 2. Try loading or acquiring real World Bank Pink Sheet data
        self.load_or_acquire_real_data()

    def load_or_acquire_real_data(self, force_download: bool = False):
        try:
            # Check if already in SQLite
            meta = get_monthly_dataset_metadata()
            gold_rows = load_stored_monthly_series("gold")
            oil_rows = load_stored_monthly_series("oil")
            
            if force_download or not meta or not gold_rows or not oil_rows:
                # Download and ingest
                raw_path = download_pink_sheet(force=force_download)
                parsed = parse_pink_sheet_xml(raw_path)
                store_monthly_commodity_data(parsed["records"], parsed["gold_meta"], parsed["oil_meta"])
                meta = get_monthly_dataset_metadata()
                gold_rows = load_stored_monthly_series("gold")
                oil_rows = load_stored_monthly_series("oil")
                
            if gold_rows and oil_rows:
                self.real_metadata = meta
                # Parse aligned monthly dates and prices
                gold_dict = {r["date"]: r["close"] for r in gold_rows}
                oil_dict = {r["date"]: r["close"] for r in oil_rows}
                all_dates = sorted(list(set(gold_dict.keys()) & set(oil_dict.keys())))
                
                self.real_monthly_dates = [datetime.strptime(d, "%Y-%m-%d").date() for d in all_dates]
                self.real_monthly_prices = {
                    "gold": np.array([gold_dict[d] for d in all_dates], dtype=float),
                    "oil": np.array([oil_dict[d] for d in all_dates], dtype=float)
                }
                
                self.source_kind = "live"
                self.provider_name = "world-bank-pink-sheet"
                self.last_refresh_time = time.time()
                print(f"[DataManager] Successfully loaded {len(all_dates)} real monthly observations from World Bank Pink Sheet.")
        except Exception as e:
            print(f"[DataManager] Could not load real data: {e}. Falling back to synthetic baseline.")
            self.source_kind = "demo"
            self.provider_name = "synthetic-preloaded"

    def refresh(self) -> Dict[str, Any]:
        self.load_or_acquire_real_data(force_download=True)
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.last_refresh_time))
        if self.real_metadata:
            msg = (
                f"Data refreshed from World Bank Pink Sheet: "
                f"{len(self.real_monthly_dates)} monthly observations "
                f"({self.real_monthly_dates[0].isoformat()} to {self.real_monthly_dates[-1].isoformat()})."
            )
        else:
            msg = "Data refreshed using deterministic synthetic series."
            
        return {
            "accepted": True,
            "message": msg,
            "last_refresh": now_str
        }

market_manager = MarketDataManager()
