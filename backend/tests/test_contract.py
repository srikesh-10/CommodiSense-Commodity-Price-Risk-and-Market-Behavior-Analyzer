from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data

def test_market_summary():
    res = client.get("/api/market/summary")
    assert res.status_code == 200
    data = res.json()
    assert "coverage" in data
    assert len(data["coverage"]) == 2

def test_market_prices():
    res = client.get("/api/market/prices?commodity=gold&period=1m&interval=daily")
    assert res.status_code == 200
    data = res.json()
    assert data["commodity"] == "gold"
    assert len(data["points"]) > 0
    assert "close" in data["points"][0]

def test_analysis_run():
    payload = {
        "commodities": ["gold", "oil"],
        "period": "1y",
        "interval": "daily",
        "objective": "patterns",
        "clustering": {
            "algorithm": "kmeans",
            "n_clusters": 3,
            "pca_components": 2
        },
        "features": ["log_return", "rolling_vol_20"],
        "scaling": "standard",
        "random_state": 42,
        "metrics": ["silhouette"]
    }
    res = client.post("/api/analysis/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "run_id" in data
    assert "clustering" in data
    assert len(data["clustering"]["clusters"]) == 3
    assert "points" in data["clustering"]

def test_experiments():
    res = client.get("/api/models/experiments")
    assert res.status_code == 200
    data = res.json()
    assert "experiments" in data

