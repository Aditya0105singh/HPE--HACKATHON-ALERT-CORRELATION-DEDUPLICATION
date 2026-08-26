"""CAUSAL ENGINE — which of these signals actually caused the others.

Correlation says a set of signals belongs to one incident. It does not say
which one is the cause, and that is the question the on-call engineer actually
has. "Earliest alert wins" is wrong often enough to erode trust: alarm
evaluation intervals differ per source, so the first thing to *breach* is
frequently a downstream victim with a twitchier alarm rather than the origin.

Five passes over each cluster:

  1. TEMPORAL ORDERING   — onset precedence between services, not raw
                           per-signal timestamps.
  2. DEPENDENCY POSITION — how much of the observed damage sits downstream of
                           this candidate in the call graph.
  3. EVIDENCE FUSION     — how strong and how corroborated the evidence is,
                           across metric, log and trace sources.
  4. CAUSE vs SYMPTOM    — a service with a failing dependency of its own is a
                           victim, not an origin.
  5. COUNTERFACTUAL      — graph ablation: remove the candidate; if everything
                           it accounted for is still explained by something
                           else, it was never necessary. Reject it.

Pass 5 is what separates this from ranking heuristics. Passes 1-4 can all be
fooled by a service that merely *looks* central; ablation asks the
counterfactual question directly — would these failures still be explained
without you? — and a candidate that survives it is necessary, not just
plausible.

Every pass is a graph operation or a comparison over tens of signals. There is
no model, no training, and no inference call, which is why this fits inside a
24-hour build and stays explainable enough to defend in a ticket.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

import networkx as nx

from .correlate import Cluster, DependencyGraph
from .signal import SEVERITY_RANK, Signal, SignalSource

# Relative weight of each ranking pass. Ablation is not weighted here — it is
# a filter applied afterwards, because "not necessary" is a disqualification,
# not a small penalty.
W_TEMPORAL = 0.30
W_DEPENDENCY = 0.40
W_EVIDENCE = 0.30


@dataclass
class CandidateScore:
    """Why one service was or wasn't judged the root cause."""

    service: str
    temporal_precedence: float
    dependency_reach: float
    evidence_strength: float
    rank_score: float
    is_symptom: bool
    symptom_of: list[str] = field(default_factory=list)
    ablation_survived: bool = True
    uniquely_explains: list[str] = field(default_factory=list)
    rejection_reason: str = ""
    first_seen: datetime | None = None
    signal_count: int = 0
    source_kinds: list[str] = field(default_factory=list)

    def explain(self) -> str:
        if self.rejection_reason:
            return self.rejection_reason
        parts = [
            f"upstream of {len(self.uniquely_explains)} affected service(s) nothing else explains"
            if self.uniquely_explains else "",
            f"onset precedes {self.temporal_precedence:.0%} of affected services",
            f"evidence from {len(self.source_kinds)} independent source(s)",
        ]
        return "; ".join(p for p in parts if p)


@dataclass
class CausalResult:
    root_cause_service: str | None
    root_cause_signal: Signal | None
    confidence: float
    candidates: list[CandidateScore]
    rejected_by_ablation: list[str] = field(default_factory=list)
    reasoning: list[str] = field(default_factory=list)

    @property
    def confidence_pct(self) -> int:
        return int(round(self.confidence * 100))


# --------------------------------------------------------------------------
# pass 1 — temporal ordering
# --------------------------------------------------------------------------


def _service_onsets(cluster: Cluster) -> dict[str, datetime]:
    """Earliest signal per service.

    Deliberately per-service, not per-signal: a service that emits fifty log
    lines does not become 'earlier' than one that emits a single alarm. Onset
    is the property that matters for precedence.
    """
    onsets: dict[str, datetime] = {}
    for signal in cluster.signals:
        current = onsets.get(signal.service)
        if current is None or signal.timestamp < current:
            onsets[signal.service] = signal.timestamp
    return onsets


def temporal_precedence(service: str, onsets: dict[str, datetime]) -> float:
    """Fraction of other affected services whose onset comes strictly later."""
    others = [s for s in onsets if s != service]
    if not others:
        return 1.0
    mine = onsets[service]
    later = sum(1 for s in others if onsets[s] > mine)
    return later / len(others)


# --------------------------------------------------------------------------
# pass 2 — dependency position
# --------------------------------------------------------------------------


def _dependents(graph: DependencyGraph, service: str) -> set[str]:
    """Services that transitively call `service`.

    Edges run caller → callee, so failure propagates *against* the edges: when
    a database dies, its callers break. The set of things affected by a
    service failing is therefore its ancestors, not its descendants — getting
    this direction backwards silently inverts every causal verdict.
    """
    if service not in graph.graph:
        return set()
    return set(nx.ancestors(graph.graph, service))


def dependency_reach(
    service: str, affected: set[str], graph: DependencyGraph
) -> tuple[float, set[str]]:
    """How much of the observed damage is downstream of this candidate."""
    others = affected - {service}
    if not others:
        return 1.0, set()
    reached = _dependents(graph, service) & others
    return len(reached) / len(others), reached


# --------------------------------------------------------------------------
# pass 3 — evidence fusion
# --------------------------------------------------------------------------

_SOURCE_FAMILY = {
    SignalSource.CLOUDWATCH_METRIC: "metric",
    SignalSource.CLOUDWATCH_LOG: "log",
    SignalSource.APP_LOG: "log",
    SignalSource.GRAFANA_ALERT: "metric",
    SignalSource.TRACE_SPAN: "trace",
}


def evidence_strength(signals: list[Signal]) -> tuple[float, list[str]]:
    """Fuse anomaly magnitude, severity and cross-source corroboration.

    Corroboration is weighted heavily on purpose: one noisy exporter can
    produce a large anomaly score on its own, but metric *and* log *and* trace
    evidence agreeing is very hard to fake.
    """
    if not signals:
        return 0.0, []

    families = sorted({_SOURCE_FAMILY.get(s.source, "other") for s in signals})
    peak = max((s.anomaly_score for s in signals), default=0.0)
    worst_rank = min((SEVERITY_RANK.get(s.severity, 3) for s in signals), default=3)
    severity_score = 1.0 - (worst_rank / 3.0)
    corroboration = min(len(families) / 3.0, 1.0)

    score = 0.40 * peak + 0.25 * severity_score + 0.35 * corroboration
    return min(score, 1.0), families


# --------------------------------------------------------------------------
# pass 5 — counterfactual by graph ablation
# --------------------------------------------------------------------------


def ablation_test(
    candidate: str,
    candidates: list[str],
    affected: set[str],
    graph: DependencyGraph,
) -> tuple[bool, set[str]]:
    """Would the observed failures still be explained without this candidate?

    A candidate C "explains" service X when X transitively depends on C, so C
    failing would propagate to X. We compute what C explains, then what every
    *other* candidate explains, and take the difference.

    Self-explanation is excluded deliberately. Every affected service is
    nominally a candidate, so if a candidate were allowed to explain itself,
    every ablation would trivially succeed and the test would measure nothing.

    Returns (survived, uniquely_explained). Empty unique set means C accounts
    for nothing that another failing service doesn't already account for —
    which is the signature of a symptom being mistaken for a cause.
    """
    mine = _dependents(graph, candidate) & (affected - {candidate})

    ablated = graph.graph.copy()
    if candidate in ablated:
        ablated.remove_node(candidate)

    explained_by_others: set[str] = set()
    for other in candidates:
        if other == candidate or other not in ablated:
            continue
        explained_by_others |= set(nx.ancestors(ablated, other)) & affected

    unique = mine - explained_by_others
    return bool(unique), unique


# --------------------------------------------------------------------------
# orchestration
# --------------------------------------------------------------------------


def analyse(cluster: Cluster, graph: DependencyGraph) -> CausalResult:
    """Run all five passes over one cluster and pick a root cause."""
    by_service: dict[str, list[Signal]] = {}
    for signal in cluster.signals:
        by_service.setdefault(signal.service, []).append(signal)

    affected = set(by_service)
    onsets = _service_onsets(cluster)
    candidates = sorted(affected)

    scores: list[CandidateScore] = []
    for service in candidates:
        signals = by_service[service]
        temporal = temporal_precedence(service, onsets)
        reach, reached = dependency_reach(service, affected, graph)
        strength, families = evidence_strength(signals)

        # Pass 4 — cause vs symptom. A service whose own dependency is also
        # failing inside this cluster is downstream of the real problem.
        failing_deps = sorted(
            dep for dep in graph.graph.successors(service) if dep in affected
        ) if service in graph.graph else []

        survived, unique = ablation_test(service, candidates, affected, graph)

        rank = (
            W_TEMPORAL * temporal
            + W_DEPENDENCY * reach
            + W_EVIDENCE * strength
        )

        score = CandidateScore(
            service=service,
            temporal_precedence=temporal,
            dependency_reach=reach,
            evidence_strength=strength,
            rank_score=round(rank, 4),
            is_symptom=bool(failing_deps),
            symptom_of=failing_deps,
            ablation_survived=survived,
            uniquely_explains=sorted(unique),
            first_seen=onsets.get(service),
            signal_count=len(signals),
            source_kinds=families,
        )
        if not survived:
            score.rejection_reason = (
                "rejected by counterfactual: removing it leaves every affected "
                "service still explained by another failing dependency"
            )
        elif failing_deps:
            score.rejection_reason = (
                f"symptom — its own dependency {', '.join(failing_deps)} is also failing"
            )
        scores.append(score)

    survivors = [s for s in scores if s.ablation_survived and not s.is_symptom]
    # If ablation eliminated everything, the graph is too sparse to arbitrate
    # (common when tracing hasn't observed the relevant edges yet). Fall back
    # to ranking rather than returning no answer at all — but say so, so the
    # reviewer knows the causal claim is weaker than usual.
    fell_back = False
    if not survivors:
        survivors = scores
        fell_back = True

    survivors.sort(key=lambda s: (-s.rank_score, s.first_seen or datetime.max))
    best = survivors[0] if survivors else None

    reasoning: list[str] = []
    root_signal = None
    confidence = 0.0

    if best is not None:
        signals = by_service[best.service]
        root_signal = _representative_signal(signals)
        runner_up = survivors[1].rank_score if len(survivors) > 1 else 0.0
        confidence = _confidence(best, runner_up, fell_back)

        reasoning.append(
            f"{best.service} ranked highest ({best.rank_score:.2f}) on temporal precedence "
            f"{best.temporal_precedence:.0%}, dependency reach {best.dependency_reach:.0%}, "
            f"evidence {best.evidence_strength:.2f}."
        )
        if best.uniquely_explains:
            reasoning.append(
                "Counterfactual: removing it leaves "
                f"{', '.join(best.uniquely_explains)} unexplained, so it is necessary "
                "to account for the observed failures."
            )
        if fell_back:
            reasoning.append(
                "No candidate survived the counterfactual cleanly — the dependency graph "
                "lacks the edges needed to arbitrate, so this ranking is advisory."
            )
        rejected = [s.service for s in scores if not s.ablation_survived]
        if rejected:
            reasoning.append(
                f"Ruled out as symptoms rather than causes: {', '.join(rejected)}."
            )

    return CausalResult(
        root_cause_service=best.service if best else None,
        root_cause_signal=root_signal,
        confidence=confidence,
        candidates=sorted(scores, key=lambda s: -s.rank_score),
        rejected_by_ablation=[s.service for s in scores if not s.ablation_survived],
        reasoning=reasoning,
    )


# --------------------------------------------------------------------------
# causal splitting
# --------------------------------------------------------------------------


def _disjoint(a: list[str], b: list[str]) -> bool:
    return not (set(a) & set(b))


# Words that appear in most service names and so distinguish nothing.
_GENERIC_NAME_PARTS = {"service", "svc", "api", "app", "server", "cluster", "primary"}


def _name_tokens(service: str) -> set[str]:
    """Meaningful words in a service name, e.g. redis-cache -> {redis, cache}."""
    parts = re.split(r"[^a-z0-9]+", (service or "").lower())
    return {p for p in parts if len(p) > 2 and p not in _GENERIC_NAME_PARTS}


# Above this, two centres are describing the same kind of failure and are
# treated as one cascade. Deliberately low: the bar for *keeping* an incident
# whole is low, because wrongly splitting one is the cheaper error to avoid
# than wrongly merging two.
EVIDENCE_AGREEMENT_THRESHOLD = 0.22


def _evidence_agrees(cluster: Cluster, service_a: str, service_b: str) -> bool:
    """Do two candidate centres describe the same kind of failure?

    Compares the best evidence match between the two services' signals. A
    database exhaustion and a JWKS outage share almost no vocabulary once
    alarm boilerplate is discounted; two symptoms of one cascade usually do.
    """
    from .correlate import template_similarity

    signals_a = [s for s in cluster.signals if s.service == service_a]
    signals_b = [s for s in cluster.signals if s.service == service_b]
    if not signals_a or not signals_b:
        return False
    best = max(
        (template_similarity(a, b) for a in signals_a for b in signals_b),
        default=0.0,
    )
    return best >= EVIDENCE_AGREEMENT_THRESHOLD


def refine_clusters(
    clusters: list[Cluster], graph: DependencyGraph
) -> tuple[list[Cluster], list[str]]:
    """Split clusters that contain more than one independent causal centre.

    Correlation groups by similarity, and similarity has a blind spot: two
    unrelated incidents hitting the *same service at the same moment* look
    almost identical to it — same service, same time, adjacent in the graph.
    Only their evidence differs, and evidence is the smallest term in the
    similarity sum, so it loses.

    Causality can see what similarity cannot. If two candidates both survive
    the counterfactual and each uniquely explains a *disjoint* set of damage,
    then neither accounts for the other's failures — which is the definition
    of two incidents, not one. Splitting on that is a causal judgement, not a
    threshold tweak, and it is why the ablation test earns its place.

    Signals are then assigned to whichever centre their evidence actually
    resembles, deliberately ignoring time: when incidents are concurrent,
    timing carries no information at all, and leaning on it would just re-run
    the mistake that merged them.
    """
    refined: list[Cluster] = []
    notes: list[str] = []

    for cluster in clusters:
        result = analyse(cluster, graph)
        centres = [
            c for c in result.candidates
            if c.ablation_survived and c.uniquely_explains
        ]
        # Two centres are independent only if all three hold:
        #
        #   1. Their unique explanation sets are disjoint.
        #   2. Neither explains the other. Disjointness alone is *not* enough:
        #      in a cascade A→B→C every link uniquely explains the next, so
        #      condition 1 is trivially true and a plain disjointness rule
        #      shreds every genuine cascade into one incident per hop.
        #   3. Their evidence disagrees. Topology cannot settle this on its
        #      own — a database failing really could explain an auth failure —
        #      so what separates "one cascade" from "two coincident faults" is
        #      whether the two centres are describing the same kind of trouble.
        selected: list[CandidateScore] = []
        for candidate in sorted(centres, key=lambda c: -c.rank_score):
            independent = True
            for chosen in selected:
                if not _disjoint(candidate.uniquely_explains, chosen.uniquely_explains):
                    independent = False
                elif (candidate.service in chosen.uniquely_explains
                      or chosen.service in candidate.uniquely_explains):
                    independent = False  # cascade link, not a second incident
                elif _evidence_agrees(cluster, candidate.service, chosen.service):
                    independent = False
                if not independent:
                    break
            if independent:
                selected.append(candidate)

        if len(selected) < 2:
            refined.append(cluster)
            continue

        parts = _assign_to_centres(cluster, selected, graph)
        if len(parts) < 2:
            refined.append(cluster)
            continue

        notes.append(
            f"cluster {cluster.cluster_id} split into {len(parts)} incidents on "
            f"disjoint causal centres: {', '.join(c.service for c in selected)}"
        )
        for signals in parts:
            part = Cluster(cluster_id=0, signals=sorted(signals, key=lambda s: s.timestamp))
            part.gate_reasons = dict(cluster.gate_reasons)
            part.mean_similarity = cluster.mean_similarity
            # A split cluster is inherently less certain than one that never
            # needed splitting — say so rather than inheriting the original's
            # confidence unchanged.
            part.confidence = round(cluster.confidence * 0.85, 2)
            refined.append(part)

    for index, cluster in enumerate(refined):
        cluster.cluster_id = index
    return refined, notes


def _assign_to_centres(
    cluster: Cluster, centres: list[CandidateScore], graph: DependencyGraph
) -> list[list[Signal]]:
    """Partition a cluster's signals across its causal centres."""
    from .correlate import _tokens, template_similarity

    # Seed each core with the centre's OWN signals only.
    #
    # The tempting alternative — seeding from everything the centre
    # topologically explains — poisons the core exactly when it matters. Here
    # redis-cache legitimately explains auth-service, so a territory-based
    # core swallows auth-service's signals wholesale, including the ones
    # belonging to a *different* concurrent incident. The core then "proves"
    # the wrong answer, because the answer was assumed when building it.
    #
    # A centre's own signals are the one thing that cannot be contested: they
    # are what made it a centre.
    cores: dict[str, list[Signal]] = {}
    for centre in centres:
        own = [s for s in cluster.signals if s.service == centre.service]
        cores[centre.service] = own or [_representative_signal(cluster.signals)]

    # The centre's service name is itself evidence — a log line mentioning
    # "cache unavailable" is talking about redis-cache even when it shares no
    # vocabulary with that service's metric alarm.
    core_vocab: dict[str, set[str]] = {}
    for centre in centres:
        vocab: set[str] = set()
        for member in cores[centre.service]:
            vocab |= _tokens(member) | _name_tokens(member.service)
        vocab |= _name_tokens(centre.service)
        core_vocab[centre.service] = vocab

    # A trace id is the strongest attribution evidence there is: it means the
    # signals were emitted by literally the same request. Topology can only
    # say a failure *could* propagate a certain way, and when two incidents
    # overlap on a shared dependency that is not enough — auth-service really
    # does call redis-cache, so a concurrent redis outage looks like a
    # perfectly good explanation for an auth failure that has nothing to do
    # with it. The trace says which request actually carried the error.
    core_traces: dict[str, set[str]] = {
        service: {s.trace_id for s in members if s.trace_id}
        for service, members in cores.items()
    }

    buckets: dict[str, list[Signal]] = {c.service: [] for c in centres}
    for signal in cluster.signals:
        # The emitting service is part of what a signal is about. It matters
        # most for metric alarms, whose text is pure CloudWatch boilerplate and
        # whose metric name ("5XXError") often tokenizes to nothing usable —
        # leaving the service name as the only evidence they carry at all.
        #
        # Deliberately applied only here, not in the shared tokenizer: adding
        # service names to the global similarity would pull *every* same-service
        # pair closer together, which is precisely the failure that merged
        # concurrent incidents in the first place.
        signal_tokens = _tokens(signal) | _name_tokens(signal.service)
        best_service, best_score = None, -1.0
        for centre in centres:
            core = cores[centre.service]
            trace = 1.0 if (
                signal.trace_id and signal.trace_id in core_traces[centre.service]
            ) else 0.0
            # Two views of evidence: direct signal-to-signal similarity, and
            # overlap with the centre's whole vocabulary. The second catches
            # the case where no single core signal resembles this one but the
            # subject matter plainly matches.
            direct = max((template_similarity(signal, m) for m in core), default=0.0)
            vocab = core_vocab[centre.service]
            overlap = (
                len(signal_tokens & vocab) / len(signal_tokens)
                if signal_tokens and vocab else 0.0
            )
            evidence = max(direct, overlap)
            closeness = graph.closeness(signal.service, centre.service)
            same = 1.0 if signal.service == centre.service else 0.0
            score = 0.35 * trace + 0.35 * evidence + 0.20 * closeness + 0.10 * same
            if score > best_score:
                best_service, best_score = centre.service, score
        if best_service is not None:
            buckets[best_service].append(signal)

    return [signals for signals in buckets.values() if signals]


def _representative_signal(signals: list[Signal]) -> Signal:
    """The signal that best evidences this service's failure.

    Prefers a metric alarm over a log line: an alarm carries a value and a
    threshold, which is far more useful in a ticket than the first of forty
    identical error lines.
    """
    def key(signal: Signal) -> tuple:
        is_metric = signal.source in (
            SignalSource.CLOUDWATCH_METRIC, SignalSource.GRAFANA_ALERT
        )
        return (
            0 if is_metric else 1,
            SEVERITY_RANK.get(signal.severity, 3),
            signal.timestamp,
        )

    return sorted(signals, key=key)[0]


def _confidence(best: CandidateScore, runner_up: float, fell_back: bool) -> float:
    """How much to trust the causal verdict.

    Margin matters more than absolute score: a top candidate barely ahead of
    the next one is a coin flip dressed up as an answer, and the reviewer
    should be told that rather than shown a confident-looking number.
    """
    margin = max(best.rank_score - runner_up, 0.0)
    confidence = (
        0.30 * min(margin / 0.25, 1.0)
        + 0.30 * best.dependency_reach
        + 0.20 * best.evidence_strength
        + 0.20 * (1.0 if best.uniquely_explains else 0.0)
    )
    if fell_back:
        confidence *= 0.6
    if best.is_symptom:
        confidence *= 0.5
    return round(min(max(confidence, 0.0), 1.0), 2)
