from typing import Literal, Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field

DataSourceKind = Literal["live", "preloaded", "demo"]
ApiCommodity = Literal["gold", "oil"]
ApiPeriod = Literal["1m", "3m", "6m", "1y", "5y", "all"]
ApiInterval = Literal["daily", "weekly", "monthly"]

# /api/health
class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: Optional[str] = None
    provider: Optional[str] = None
    provider_status: Optional[Literal["ok", "rate_limited", "unavailable"]] = None

# /api/market/summary
class CoverageInfo(BaseModel):
    commodity: ApiCommodity
    start: str
    end: str
    observations: int
    missing_days: Optional[int] = 0
    intervals: Optional[List[ApiInterval]] = ["daily", "weekly", "monthly"]

class QualityInfo(BaseModel):
    duplicates: int = 0
    gaps: int = 0
    outliers: int = 0
    notes: Optional[List[str]] = []

class MarketSummaryResponse(BaseModel):
    source: DataSourceKind
    provider: str
    latest_observation: str
    last_refresh: Optional[str] = None
    coverage: List[CoverageInfo]
    quality: Optional[QualityInfo] = None

# /api/market/prices
class PricePoint(BaseModel):
    date: str
    close: float
    return_pct: Optional[float] = None
    rolling_vol: Optional[float] = None

class PricesResponse(BaseModel):
    commodity: ApiCommodity
    interval: ApiInterval
    source: DataSourceKind
    points: List[PricePoint]

# /api/market/refresh
class RefreshResponse(BaseModel):
    accepted: bool
    message: Optional[str] = None
    retry_after_seconds: Optional[int] = None
    last_refresh: Optional[str] = None

# /api/analysis/run
class ClusteringConfig(BaseModel):
    algorithm: Literal["kmeans", "gmm", "hierarchical"] = "kmeans"
    n_clusters: int = Field(default=3, ge=2, le=10)
    pca_components: Literal[2, 3] = 2

class HmmConfig(BaseModel):
    n_states: int = Field(default=3, ge=2, le=8)
    covariance_type: str = "full"
    n_iter: int = Field(default=100, ge=10, le=2000)

class RiskConfig(BaseModel):
    sensitivity: Literal["conservative", "balanced", "aggressive"] = "balanced"
    var_confidence: float = 0.95
    vol_window: int = 20

class AnalysisRequest(BaseModel):
    commodities: List[ApiCommodity]
    period: ApiPeriod = "1y"
    interval: ApiInterval = "daily"
    objective: Literal["patterns", "risk", "states", "compare"] = "patterns"
    clustering: Optional[ClusteringConfig] = None
    hmm: Optional[HmmConfig] = None
    risk: Optional[RiskConfig] = None
    features: List[str] = ["log_return", "rolling_vol_20"]
    scaling: Literal["standard", "minmax", "robust"] = "standard"
    random_state: int = 42
    metrics: List[str] = ["silhouette"]

class SeriesOut(BaseModel):
    date: str
    gold: Optional[float] = None
    oil: Optional[float] = None
    gold_return: Optional[float] = None
    oil_return: Optional[float] = None
    gold_vol: Optional[float] = None
    oil_vol: Optional[float] = None

class ClusterOut(BaseModel):
    id: int
    size: int
    centroid: Dict[str, float]

class ClusterPoint(BaseModel):
    date: str
    cluster: int
    pc1: float
    pc2: float
    pc3: Optional[float] = None

class DendrogramData(BaseModel):
    icoord: List[List[float]]
    dcoord: List[List[float]]
    color_list: List[str]
    ivl: List[str]
    leaves: List[int]
    cut_threshold: float
    max_d: float
    truncated: bool = False
    total_observations: int

class ClusteringResult(BaseModel):
    algorithm: str
    clusters: List[ClusterOut]
    points: List[ClusterPoint]
    explained_variance: List[float]
    metrics: Dict[str, float]
    dendrogram: Optional[DendrogramData] = None

class HmmTimelinePoint(BaseModel):
    date: str
    state: int
    prob: float

class HmmStateStats(BaseModel):
    state: int
    mean_return: float
    volatility: float
    share: float

class HmmResult(BaseModel):
    n_states: int
    timeline: List[HmmTimelinePoint]
    transition_matrix: List[List[float]]
    state_stats: List[HmmStateStats]
    log_likelihood: Optional[float] = None
    aic: Optional[float] = None
    bic: Optional[float] = None

class CommodityRisk(BaseModel):
    max_drawdown: float
    var: float
    cvar: float
    annual_vol: float
    sharpe: Optional[float] = None

class CorrelationResult(BaseModel):
    pearson: float
    rolling: Optional[List[Dict[str, Union[str, float]]]] = None

class PeriodInfo(BaseModel):
    start: str
    end: str
    requested: ApiPeriod
    truncated: Optional[bool] = False
    note: Optional[str] = None

class AnalysisResponse(BaseModel):
    run_id: str
    source: DataSourceKind
    period: PeriodInfo
    series: List[SeriesOut]
    clustering: Optional[ClusteringResult] = None
    hmm: Optional[HmmResult] = None
    risk: Optional[Dict[str, Any]] = None
    correlation: Optional[CorrelationResult] = None
    evaluation: Optional[Dict[str, float]] = None
    methodology: Optional[List[str]] = None
    summary: Optional[str] = None

