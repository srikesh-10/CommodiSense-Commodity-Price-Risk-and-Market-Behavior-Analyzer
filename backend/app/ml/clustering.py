import numpy as np
import math
from typing import Tuple, List, Dict, Any, Optional
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from scipy.cluster.hierarchy import linkage, dendrogram

def run_pca(x: np.ndarray, n_components: int = 2) -> Tuple[np.ndarray, List[float], np.ndarray]:
    """Runs Principal Component Analysis.
    Returns:
      proj: projected component scores (n_samples, n_components)
      explained_variance_ratio: fraction of variance explained per component
      components: principal component loading vectors (n_components, n_features)
    """
    k = min(n_components, x.shape[1], x.shape[0])
    pca = PCA(n_components=k)
    proj = pca.fit_transform(x)
    ratios = [float(r) for r in pca.explained_variance_ratio_]
    return proj, ratios, pca.components_

def run_kmeans(x: np.ndarray, k: int, seed: int = 42) -> Tuple[np.ndarray, np.ndarray, float]:
    """Runs K-Means clustering with deterministic k-means++ initialization."""
    km = KMeans(n_clusters=k, random_state=seed, n_init=10)
    labels = km.fit_predict(x)
    centers = km.cluster_centers_
    inertia = float(km.inertia_)
    return labels, centers, inertia

def run_gmm(x: np.ndarray, k: int, seed: int = 42, iters: int = 100, cov_type: str = "full") -> Tuple[np.ndarray, np.ndarray, np.ndarray, float, GaussianMixture]:
    """Runs Gaussian Mixture Model (EM) with regularization to avoid singular covariance."""
    gm = GaussianMixture(
        n_components=k,
        random_state=seed,
        max_iter=iters,
        covariance_type=cov_type,
        reg_covar=1e-4
    )
    labels = gm.fit_predict(x)
    centers = gm.means_
    weights = gm.weights_
    log_likelihood = float(gm.score(x) * len(x))
    return labels, centers, weights, log_likelihood, gm

def run_hierarchical(x: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
    """Runs Agglomerative Hierarchical clustering."""
    model = AgglomerativeClustering(n_clusters=k)
    labels = model.fit_predict(x)
    centers = np.array([x[labels == i].mean(0) for i in range(k)])
    return labels, centers

def compute_dendrogram(x: np.ndarray, k: int, date_labels: Optional[List[str]] = None) -> Dict[str, Any]:
    """Computes hierarchical clustering linkage and dendrogram coordinates using Ward's method."""
    if len(x) < 2:
        return {
            "icoord": [], "dcoord": [], "color_list": [], "ivl": [],
            "leaves": [], "cut_threshold": 0.0, "max_d": 1.0,
            "truncated": False, "total_observations": len(x)
        }
    
    Z = linkage(x, method="ward")
    if k > 1 and len(Z) >= k:
        cut = float((Z[-(k - 1), 2] + Z[-k, 2]) / 2.0)
    else:
        cut = float(Z[-1, 2])
        
    truncated = len(x) > 40
    p_val = 30 if truncated else len(x)
    
    d = dendrogram(
        Z,
        p=p_val,
        truncate_mode="lastp" if truncated else None,
        color_threshold=cut,
        labels=date_labels if not truncated else None,
        no_plot=True
    )
    
    icoord = [[float(c) for c in link] for link in d["icoord"]]
    dcoord = [[float(c) for c in link] for link in d["dcoord"]]
    max_d = float(max(max(l) for l in dcoord)) if dcoord else 1.0
    
    return {
        "icoord": icoord,
        "dcoord": dcoord,
        "color_list": list(d["color_list"]),
        "ivl": list(d["ivl"]),
        "leaves": [int(l) for l in d["leaves"]],
        "cut_threshold": round(cut, 4),
        "max_d": round(max_d, 4),
        "truncated": truncated,
        "total_observations": len(x)
    }

def compute_metrics(x: np.ndarray, labels: np.ndarray, requested: Optional[List[str]] = None) -> Dict[str, float]:
    """Calculates cluster evaluation metrics: silhouette score, Davies-Bouldin, and Calinski-Harabasz."""
    res = {}
    n_unique = len(np.unique(labels))
    if n_unique < 2 or n_unique >= len(x):
        return res
        
    req = requested or ["silhouette", "davies_bouldin", "calinski_harabasz"]
    
    if "silhouette" in req:
        try:
            res["silhouette"] = round(float(silhouette_score(x, labels)), 4)
        except Exception:
            pass
    if "davies_bouldin" in req:
        try:
            res["davies_bouldin"] = round(float(davies_bouldin_score(x, labels)), 4)
        except Exception:
            pass
    if "calinski_harabasz" in req:
        try:
            res["calinski_harabasz"] = round(float(calinski_harabasz_score(x, labels)), 2)
        except Exception:
            pass
    return res
