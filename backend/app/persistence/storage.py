import sqlite3
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.config import settings

def init_db():
    conn = sqlite3.connect(settings.DB_PATH)
    cur = conn.cursor()
    
    # Existing tables
    cur.execute("""
    CREATE TABLE IF NOT EXISTS analysis_runs (
        run_id TEXT PRIMARY KEY,
        created_at TEXT,
        objective TEXT,
        config_json TEXT,
        summary TEXT,
        metrics_json TEXT
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        created_at TEXT,
        algorithm TEXT,
        n_clusters INTEGER,
        silhouette REAL,
        details_json TEXT
    )
    """)
    
    # New tables for commodity dataset observations and metadata
    cur.execute("""
    CREATE TABLE IF NOT EXISTS dataset_metadata (
        source_id TEXT PRIMARY KEY,
        dataset_name TEXT,
        retrieval_timestamp TEXT,
        frequency TEXT,
        earliest_date TEXT,
        latest_date TEXT,
        gold_series TEXT,
        gold_unit TEXT,
        oil_series TEXT,
        oil_unit TEXT,
        total_observations INTEGER
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS monthly_prices (
        date TEXT,
        commodity TEXT,
        close_price REAL,
        unit TEXT,
        source TEXT,
        PRIMARY KEY (date, commodity)
    )
    """)
    
    conn.commit()
    conn.close()

def save_analysis_run(run_id: str, objective: str, config: Dict[str, Any], summary: str, metrics: Dict[str, Any]):
    try:
        conn = sqlite3.connect(settings.DB_PATH)
        cur = conn.cursor()
        cur.execute("""
        INSERT OR REPLACE INTO analysis_runs (run_id, created_at, objective, config_json, summary, metrics_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (run_id, datetime.now(timezone.utc).isoformat(), objective, json.dumps(config), summary, json.dumps(metrics)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB] Error saving analysis run: {e}")

def save_experiment(exp_id: str, algorithm: str, n_clusters: int, silhouette: float, details: Dict[str, Any]):
    try:
        conn = sqlite3.connect(settings.DB_PATH)
        cur = conn.cursor()
        cur.execute("""
        INSERT OR REPLACE INTO experiments (id, created_at, algorithm, n_clusters, silhouette, details_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (exp_id, datetime.now(timezone.utc).isoformat(), algorithm, n_clusters, silhouette, json.dumps(details)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB] Error saving experiment: {e}")

def get_recent_experiments(limit: int = 20) -> List[Dict[str, Any]]:
    try:
        conn = sqlite3.connect(settings.DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT id, algorithm, n_clusters, silhouette FROM experiments ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        conn.close()
        return [{"id": r[0], "algorithm": r[1], "n_clusters": r[2], "silhouette": r[3]} for r in rows]
    except Exception as e:
        print(f"[DB] Error retrieving experiments: {e}")
        return []

def store_monthly_commodity_data(
    records: List[Dict[str, Any]],
    gold_meta: Dict[str, str],
    oil_meta: Dict[str, str],
    source_id: str = "world-bank-pink-sheet"
) -> Dict[str, Any]:
    """Store cleaned monthly observations and metadata into SQLite."""
    conn = sqlite3.connect(settings.DB_PATH)
    cur = conn.cursor()
    
    clean_gold = 0
    clean_oil = 0
    earliest = records[0]["date"] if records else None
    latest = records[-1]["date"] if records else None
    
    for r in records:
        d = r["date"]
        g = r["gold"]
        o = r["oil"]
        if g is not None:
            cur.execute("""
            INSERT OR REPLACE INTO monthly_prices (date, commodity, close_price, unit, source)
            VALUES (?, ?, ?, ?, ?)
            """, (d, "gold", float(g), gold_meta["unit"], source_id))
            clean_gold += 1
        if o is not None:
            cur.execute("""
            INSERT OR REPLACE INTO monthly_prices (date, commodity, close_price, unit, source)
            VALUES (?, ?, ?, ?, ?)
            """, (d, "oil", float(o), oil_meta["unit"], source_id))
            clean_oil += 1
            
    now_iso = datetime.now(timezone.utc).isoformat()
    cur.execute("""
    INSERT OR REPLACE INTO dataset_metadata (
        source_id, dataset_name, retrieval_timestamp, frequency,
        earliest_date, latest_date, gold_series, gold_unit,
        oil_series, oil_unit, total_observations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        source_id,
        "World Bank Commodity Price Data (The Pink Sheet)",
        now_iso,
        "monthly",
        earliest,
        latest,
        gold_meta["name"],
        gold_meta["unit"],
        oil_meta["name"],
        oil_meta["unit"],
        len(records)
    ))
    
    conn.commit()
    conn.close()
    
    return {
        "gold_observations": clean_gold,
        "oil_observations": clean_oil,
        "earliest": earliest,
        "latest": latest,
        "gold_unit": gold_meta["unit"],
        "oil_unit": oil_meta["unit"]
    }

def get_monthly_dataset_metadata(source_id: str = "world-bank-pink-sheet") -> Optional[Dict[str, Any]]:
    try:
        conn = sqlite3.connect(settings.DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT * FROM dataset_metadata WHERE source_id = ?", (source_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return None
        cols = ["source_id", "dataset_name", "retrieval_timestamp", "frequency",
                "earliest_date", "latest_date", "gold_series", "gold_unit",
                "oil_series", "oil_unit", "total_observations"]
        return dict(zip(cols, row))
    except Exception as e:
        print(f"[DB] Error fetching metadata: {e}")
        return None

def load_stored_monthly_series(commodity: str) -> List[Dict[str, Any]]:
    try:
        conn = sqlite3.connect(settings.DB_PATH)
        cur = conn.cursor()
        cur.execute("""
        SELECT date, close_price, unit, source FROM monthly_prices
        WHERE commodity = ? ORDER BY date ASC
        """, (commodity,))
        rows = cur.fetchall()
        conn.close()
        return [{"date": r[0], "close": r[1], "unit": r[2], "source": r[3]} for r in rows]
    except Exception as e:
        print(f"[DB] Error loading monthly series: {e}")
        return []
