import time
import math
import numpy as np
from fastapi import APIRouter
from typing import Dict, Any, List

from app.schemas.all import AnalysisRequest, AnalysisResponse, PeriodInfo, SeriesOut, ClusteringResult, ClusterOut, ClusterPoint, DendrogramData, HmmResult, HmmTimelinePoint, HmmStateStats, CorrelationResult, ClusteringConfig, HmmConfig, RiskConfig
from app.data.manager import market_manager
from app.data.features import slice_period, aggregate_interval, scale_features, log_returns, rolling_vol, momentum, range_pct, rolling_corr
from app.ml.clustering import run_pca, run_kmeans, run_gmm, run_hierarchical, compute_dendrogram, compute_metrics
from app.ml.hmm import run_hmm_em
from app.ml.risk import compute_risk_block
from app.persistence.storage import save_analysis_run

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

@router.post("/run", response_model=AnalysisResponse)
def run_analysis_pipeline(req: AnalysisRequest):
    mgr = market_manager
    # Choose real monthly or synthetic daily depending on requested interval
    if req.interval == "monthly" and mgr.real_metadata and mgr.real_monthly_dates:
        mgr_dates = mgr.real_monthly_dates
        mgr_prices = mgr.real_monthly_prices
        source_kind = "live"
    else:
        mgr_dates = mgr.synthetic_dates
        mgr_prices = mgr.synthetic_prices
        source_kind = "demo"
        
    i0 = slice_period(mgr_dates, req.period)
    
    # Interval aggregation
    if req.interval != "daily":
        dates, gold_close = aggregate_interval(mgr_dates[i0:], mgr_prices["gold"][i0:], req.interval)
        _, oil_close = aggregate_interval(mgr_dates[i0:], mgr_prices["oil"][i0:], req.interval)
        prices = {"gold": gold_close, "oil": oil_close}
        ret = {c: log_returns(prices[c]) for c in ("gold", "oil")}
        vol = {c: rolling_vol(ret[c]) for c in ("gold", "oil")}
        mom = {c: momentum(prices[c]) for c in ("gold", "oil")}
        rng_pct = {c: range_pct(prices[c]) for c in ("gold", "oil")}
        corr_roll = rolling_corr(ret["gold"], ret["oil"])
    else:
        dates = mgr_dates[i0:]
        prices = {c: mgr_prices[c][i0:] for c in ("gold", "oil")}
        ret = {c: mgr.synthetic_ret[c][i0:] for c in ("gold", "oil")}
        vol = {c: mgr.synthetic_vol[c][i0:] for c in ("gold", "oil")}
        mom = {c: mgr.synthetic_mom[c][i0:] for c in ("gold", "oil")}
        rng_pct = {c: mgr.synthetic_rng_pct[c][i0:] for c in ("gold", "oil")}
        corr_roll = mgr.synthetic_corr_roll[i0:]
        
    n = len(dates)
    series: List[SeriesOut] = []
    for i in range(n):
        row = SeriesOut(date=dates[i].isoformat())
        for c in req.commodities:
            if c == "gold":
                row.gold = round(float(prices["gold"][i]), 2)
                r = ret["gold"][i] * 100.0
                row.gold_return = None if math.isnan(r) else round(float(r), 4)
                v = vol["gold"][i]
                row.gold_vol = None if math.isnan(v) else round(float(v), 3)
            elif c == "oil":
                row.oil = round(float(prices["oil"][i]), 2)
                r = ret["oil"][i] * 100.0
                row.oil_return = None if math.isnan(r) else round(float(r), 4)
                v = vol["oil"][i]
                row.oil_vol = None if math.isnan(v) else round(float(v), 3)
        series.append(row)

    # Feature matrix extraction
    feature_dict = {
        "log_return": lambda c: ret[c] * 100.0,
        "rolling_vol_20": lambda c: vol[c],
        "momentum_20": lambda c: mom[c],
        "range_pct": lambda c: rng_pct[c]
    }
    cols = []
    for f in req.features:
        if f == "gold_oil_corr":
            if "gold" in req.commodities and "oil" in req.commodities:
                cols.append(np.nan_to_num(corr_roll))
            continue
        if f in feature_dict:
            for c in req.commodities:
                cols.append(np.nan_to_num(feature_dict[f](c)))
                
    if not cols:
        cols.append(np.nan_to_num(ret[req.commodities[0]] * 100.0))
        
    X = scale_features(np.column_stack(cols), req.scaling)
    evaluation: Dict[str, float] = {}
    clustering_res: Optional[ClusteringResult] = None
    
    # 1. Clustering
    if req.objective in ("patterns", "compare"):
        cl = req.clustering or ClusteringConfig()
        k = cl.n_clusters
        n_comp = min(cl.pca_components, X.shape[1])
        proj, ratios, _ = run_pca(X, n_comp)
        
        dendro_res = None
        if cl.algorithm == "kmeans":
            labels, centers, inertia = run_kmeans(proj, k, req.random_state)
            evaluation["inertia"] = round(inertia, 2)
        elif cl.algorithm == "gmm":
            labels, centers, _, ll, _ = run_gmm(proj, k, req.random_state, 100)
            evaluation["log_likelihood"] = round(ll, 2)
        else:
            labels, centers = run_hierarchical(proj, k)
            dendro_dict = compute_dendrogram(proj, k, [d.strftime("%Y-%m") for d in dates])
            dendro_res = DendrogramData(**dendro_dict)
            
        metrics = compute_metrics(proj, labels, req.metrics)
        evaluation.update(metrics)
        
        clusters = []
        for j in range(len(centers)):
            m = labels == j
            clusters.append(ClusterOut(
                id=j,
                size=int(m.sum()),
                centroid={f"pc{d + 1}": round(float(centers[j][d]), 4) for d in range(len(centers[j]))}
            ))
            
        points = []
        for i in range(n):
            pt_dict = {
                "date": dates[i].isoformat(),
                "cluster": int(labels[i]),
                "pc1": round(float(proj[i][0]), 4),
                "pc2": round(float(proj[i][1]), 4) if proj.shape[1] > 1 else 0.0,
                "pc3": round(float(proj[i][2]), 4) if proj.shape[1] > 2 else None
            }
            points.append(ClusterPoint(**pt_dict))
            
        clustering_res = ClusteringResult(
            algorithm=cl.algorithm,
            clusters=clusters,
            points=points,
            explained_variance=[round(r, 6) for r in ratios],
            metrics=evaluation,
            dendrogram=dendro_res
        )

    # 2. HMM
    hmm_res: Optional[HmmResult] = None
    if req.objective in ("states", "compare"):
        h_cfg = req.hmm or HmmConfig()
        obs_c = "gold" if "gold" in req.commodities else req.commodities[0]
        obs = np.column_stack([np.nan_to_num(ret[obs_c]) * 100.0, np.nan_to_num(vol[obs_c])])
        fit = run_hmm_em(obs, h_cfg.n_states, h_cfg.n_iter, h_cfg.covariance_type, req.random_state)
        if fit is not None:
            gamma = fit["gamma"]
            states = gamma.argmax(1)
            probs = gamma.max(1)
            timeline = [
                HmmTimelinePoint(date=dates[i].isoformat(), state=int(states[i]), prob=round(float(probs[i]), 4))
                for i in range(n)
            ]
            stats_list = []
            for s_idx in range(h_cfg.n_states):
                mask = states == s_idx
                sub_r = ret[obs_c][mask] * 100.0
                clean_sub_r = sub_r[~np.isnan(sub_r)]
                m_ret = float(clean_sub_r.mean()) if len(clean_sub_r) else 0.0
                v_ret = float(clean_sub_r.std() * (math.sqrt(12) if req.interval == "monthly" else math.sqrt(252))) if len(clean_sub_r) > 1 else 0.0
                stats_list.append(HmmStateStats(
                    state=s_idx,
                    mean_return=0.0 if math.isnan(m_ret) else round(m_ret, 3),
                    volatility=0.0 if math.isnan(v_ret) else round(v_ret, 2),
                    share=round(float(mask.mean()), 3)
                ))
            hmm_res = HmmResult(
                n_states=h_cfg.n_states,
                timeline=timeline,
                transition_matrix=[[round(float(val), 4) for val in row] for row in fit["trans"]],
                state_stats=stats_list,
                log_likelihood=round(float(fit["loglike"]), 2)
            )

    # 3. Risk
    risk_dict: Dict[str, Any] = {}
    r_cfg = req.risk or RiskConfig()
    freq_str = "monthly" if req.interval == "monthly" else "daily"
    for c in req.commodities:
        blk, th = compute_risk_block(
            closes=prices[c],
            returns=ret[c] * 100.0,
            confidence=r_cfg.var_confidence,
            window=r_cfg.vol_window,
            sensitivity=r_cfg.sensitivity,
            freq=freq_str
        )
        risk_dict[c] = blk
        risk_dict["thresholds"] = th

    # 4. Correlation
    clean_g = ret["gold"][~np.isnan(ret["gold"])]
    clean_o = ret["oil"][~np.isnan(ret["oil"])]
    min_len = min(len(clean_g), len(clean_o))
    corr_val = float(np.corrcoef(clean_g[:min_len], clean_o[:min_len])[0, 1]) if min_len > 1 else 0.0
    corr_res = CorrelationResult(
        pearson=round(corr_val, 4),
        rolling=[{"date": dates[i].isoformat(), "value": round(float(corr_roll[i]), 4)} for i in range(n) if not math.isnan(corr_roll[i])]
    )

    run_id = f"run-{int(time.time() * 1000)}-{req.random_state}"
    summary_text = (
        f"Analyzed {', '.join(req.commodities).upper()} across {n} observations ({req.period} window). "
        f"Detected {req.clustering.n_clusters if req.clustering else 3} behavioral clusters with {req.scaling} feature scaling."
    )
    
    save_analysis_run(run_id, req.objective, req.model_dump(), summary_text, evaluation)

    return AnalysisResponse(
        run_id=run_id,
        source=source_kind,
        period=PeriodInfo(start=dates[0].isoformat(), end=dates[-1].isoformat(), requested=req.period),
        series=series,
        clustering=clustering_res,
        hmm=hmm_res,
        risk=risk_dict,
        correlation=corr_res,
        evaluation=evaluation,
        methodology=[
            f"Dataset: World Bank Pink Sheet + verified financial time-series ({mgr.source_kind})",
            f"Pre-processing: {req.scaling} scaling over features: {', '.join(req.features)}",
            f"Clustering: {req.clustering.algorithm if req.clustering else 'kmeans'} evaluated with standard cluster metrics",
            f"Risk: Parametric & Historical Value at Risk ({int(r_cfg.var_confidence*100)}% confidence, Expected Shortfall)"
        ],
        summary=summary_text
    )
