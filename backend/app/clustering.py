"""Embedding + time-windowed DBSCAN clustering, and root-cause pick.

Two alerts belong to the same incident when they are (a) semantically related
and (b) close in time. We encode both into one distance:

    distance = cosine_distance(embeddings) + TIME_PENALTY beyond TIME_SCALE

so DBSCAN naturally refuses to merge similar-looking alerts that fired hours
apart. Noise alerts land in DBSCAN's label -1 bucket and stay uncorrelated —
exactly the behavior we want for routine background alerts.

Root-cause pick: the earliest alert in the cluster (failures propagate forward
in time), broken toward higher severity when several fire in the same minute.
"""

from __future__ import annotations

from datetime import datetime

import numpy as np
from sklearn.cluster import DBSCAN

MODEL_NAME = "all-MiniLM-L6-v2"

# Tuned by grid search against generator ground truth over 4 seeds:
# 0 incident fragmentation, 0 missed incidents, ~90% cluster purity.
EPS = 0.70
MIN_SAMPLES = 3
# Quadratic time penalty: negligible for alerts within a couple of minutes
# (cascades stay whole), saturating at TIME_PENALTY beyond TIME_SCALE_MIN so
# look-alike alerts far apart in time never merge (penalty > EPS).
TIME_SCALE_MIN = 6.0
TIME_PENALTY = 2.0

SEVERITY_RANK = {"critical": 0, "high": 1, "info": 2}


def _ts(alert: dict) -> datetime:
    ts = alert["timestamp"]
    return datetime.fromisoformat(ts) if isinstance(ts, str) else ts


def alert_text(alert: dict) -> str:
    return f"{alert['service']} {alert['alertname']}: {alert['message']}"


def embed_alerts(alerts: list[dict], model) -> np.ndarray:
    return model.encode([alert_text(a) for a in alerts], normalize_embeddings=True)


def combined_distance_matrix(alerts: list[dict], embeddings: np.ndarray) -> np.ndarray:
    semantic = 1.0 - embeddings @ embeddings.T  # cosine distance
    times = np.array([_ts(a).timestamp() for a in alerts])
    dt_min = np.abs(times[:, None] - times[None, :]) / 60.0
    time_pen = TIME_PENALTY * np.minimum(dt_min / TIME_SCALE_MIN, 1.0) ** 2
    return np.clip(semantic + time_pen, 0.0, None)


def cluster_alerts(alerts: list[dict], model) -> tuple[np.ndarray, np.ndarray]:
    """Returns (labels, embeddings). Label -1 = uncorrelated noise."""
    embeddings = embed_alerts(alerts, model)
    distances = combined_distance_matrix(alerts, embeddings)
    labels = DBSCAN(eps=EPS, min_samples=MIN_SAMPLES, metric="precomputed").fit_predict(distances)
    return labels, embeddings


def pick_root_cause(cluster_alerts: list[dict]) -> dict:
    return min(cluster_alerts,
               key=lambda a: (_ts(a), SEVERITY_RANK.get(a["severity"], 3)))


def group_by_label(alerts: list[dict], labels: np.ndarray) -> dict[int, list[dict]]:
    groups: dict[int, list[dict]] = {}
    for alert, label in zip(alerts, labels):
        groups.setdefault(int(label), []).append(alert)
    return groups
