import numpy as np
import pytest
from app.data.features import log_returns, rolling_vol, momentum, scale_features
from app.ml.clustering import run_pca, run_kmeans, run_gmm, run_hierarchical, compute_dendrogram, compute_metrics
from app.persistence.storage import load_stored_monthly_series

@pytest.fixture
def real_feature_matrix():
    gold = load_stored_monthly_series("gold")
    oil = load_stored_monthly_series("oil")
    g_closes = np.array([r["close"] for r in gold])
    o_closes = np.array([r["close"] for r in oil])
    
    g_ret = log_returns(g_closes, as_percent=True)
    o_ret = log_returns(o_closes, as_percent=True)
    g_vol = rolling_vol(g_ret, window=12, freq="monthly")
    o_vol = rolling_vol(o_ret, window=12, freq="monthly")
    
    X_raw = np.column_stack([
        np.nan_to_num(g_ret),
        np.nan_to_num(o_ret),
        np.nan_to_num(g_vol),
        np.nan_to_num(o_vol)
    ])
    return scale_features(X_raw, method="standard")

def test_pca_decomposition(real_feature_matrix):
    X = real_feature_matrix
    proj, ratios, comps = run_pca(X, n_components=2)
    
    assert proj.shape == (len(X), 2)
    assert len(ratios) == 2
    assert 0.0 < sum(ratios) <= 1.0
    assert ratios[0] >= ratios[1]
    assert np.all(np.isfinite(proj))

def test_kmeans_clustering(real_feature_matrix):
    X = real_feature_matrix
    proj, _, _ = run_pca(X, n_components=2)
    labels, centers, inertia = run_kmeans(proj, k=3, seed=42)
    
    assert len(labels) == len(proj)
    assert len(np.unique(labels)) == 3
    assert centers.shape == (3, 2)
    assert inertia > 0.0
    
    metrics = compute_metrics(proj, labels)
    assert "silhouette" in metrics
    assert -1.0 <= metrics["silhouette"] <= 1.0
    assert "davies_bouldin" in metrics
    assert metrics["davies_bouldin"] >= 0.0
    assert "calinski_harabasz" in metrics
    assert metrics["calinski_harabasz"] > 0.0

def test_gmm_clustering(real_feature_matrix):
    X = real_feature_matrix
    proj, _, _ = run_pca(X, n_components=2)
    labels, centers, weights, loglike, _ = run_gmm(proj, k=3, seed=42)
    
    assert len(labels) == len(proj)
    assert centers.shape == (3, 2)
    assert len(weights) == 3
    assert np.isclose(sum(weights), 1.0)
    assert np.isfinite(loglike)

def test_hierarchical_clustering(real_feature_matrix):
    X = real_feature_matrix
    proj, _, _ = run_pca(X, n_components=2)
    labels, centers = run_hierarchical(proj, k=3)
    
    assert len(labels) == len(proj)
    assert len(np.unique(labels)) == 3
    assert centers.shape == (3, 2)

def test_dendrogram_computation(real_feature_matrix):
    X = real_feature_matrix[:30]
    dates = [f"2024-{i:02d}" for i in range(1, 31)]
    dendro = compute_dendrogram(X, k=3, date_labels=dates)
    
    assert "icoord" in dendro
    assert "dcoord" in dendro
    assert "cut_threshold" in dendro
    assert len(dendro["icoord"]) == 29
    assert dendro["cut_threshold"] > 0.0
    assert len(dendro["ivl"]) == 30
    assert dendro["total_observations"] == 30

