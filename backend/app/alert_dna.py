"""Alert DNA — differentiator #2.

Matches a newly formed cluster against a library of past incidents and their
resolutions: "this looks 87% similar to the Redis exhaustion from 3 days ago —
restarting the connection pool fixed it in 12 minutes." Institutional memory
as an automatic assist.

Implementation: the same sentence-transformers model used for clustering embeds
each past incident's symptom text; a new cluster's centroid embedding is
compared by cosine similarity. Above MATCH_THRESHOLD → match; below → the
system honestly reports "novel incident" (which is itself a demo moment).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

MATCH_THRESHOLD = 0.60

DEFAULT_LIBRARY = Path(__file__).resolve().parents[2] / "data" / "seed_incident_library.json"


class AlertDNA:
    def __init__(self, model, library_path: Path = DEFAULT_LIBRARY):
        """model: a loaded sentence_transformers.SentenceTransformer (shared
        with the clustering step — no second model in memory)."""
        self.model = model
        with open(library_path, encoding="utf-8") as f:
            self.library = json.load(f)
        # Embed each incident as the mean of its individual symptom phrases —
        # matches the granularity of per-alert texts far better than one long
        # prose sentence, so similarities separate cleanly.
        embeddings = []
        for inc in self.library:
            phrases = [p.strip() for p in inc["symptom_pattern"].split(",")]
            phrase_emb = self.model.encode(phrases, normalize_embeddings=True)
            centroid = phrase_emb.mean(axis=0)
            embeddings.append(centroid / np.linalg.norm(centroid))
        self.library_embeddings = np.vstack(embeddings)

    def match(self, cluster_alerts: list[dict]) -> dict | None:
        """Return the best-matching past incident for a cluster, or None if
        nothing clears the threshold (novel incident)."""
        texts = [f"{a['service']} {a['alertname']}: {a['message']}" for a in cluster_alerts]
        centroid = self.model.encode(texts, normalize_embeddings=True).mean(axis=0)
        centroid /= np.linalg.norm(centroid)

        similarities = self.library_embeddings @ centroid
        best = int(np.argmax(similarities))
        best_sim = float(similarities[best])

        if best_sim < MATCH_THRESHOLD:
            return None
        return {
            "similarity_pct": round(best_sim * 100, 1),
            **self.library[best],
        }
