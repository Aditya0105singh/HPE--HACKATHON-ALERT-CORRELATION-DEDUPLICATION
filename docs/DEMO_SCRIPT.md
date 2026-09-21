# Judge demo script (about 2 minutes)

Before you start: backend on :8001, frontend on :3001, browser on the Overview.

1. **Set the scene (10s).** "Alert fatigue: one failure, dozens of signals, 20-40 minutes to write
   a ticket. We turn that into one explained incident and never publish without a human."
2. **Inject failure (10s).** Click *Inject failure*. "That runs a fixed failure through the real
   pipeline: CloudWatch, Grafana and OpenTelemetry telemetry."
3. **The funnel (10s).** Point at 17 -> 6 -> 1 and the red 1 rejected. "Seventeen signals, twelve
   were the same error and collapsed. One incident. One alert rejected."
4. **Correlation Explorer (25s).** Scroll the signal list. "Every signal names why it joined: same
   service, dependency edge, or the shared trace ID. Time alone never groups." Point at the rejected
   disk warning: "It fired in the same minute. No shared service, dependency or trace, so it stays out."
5. **Root cause (15s).** "Earliest alert wins is wrong. `postgres-primary` scores 0.89; the others are
   symptoms the counterfactual check rules out." (It is rule-based graph ablation; say so.)
6. **Why P1 (15s).** Severity card. "Four weighted factors add to 0.846; 0.75 is the P1 line. Every
   input is visible."
7. **The ticket (15s).** Green block = computed facts. Purple block = AI prose. "The LLM cannot add
   services, times, severity or a root cause." (Template fallback shows while no LLM key is set.)
8. **The gate (20s).** Point at "AWAITING HUMAN REVIEW - Jira not created". Enter a name, click
   *Approve & create Jira*. "Approval mints a single-use token. Without it the Jira call is rejected;
   we test that." Show the published key (mock Jira).
9. **Stateful incident (15s).** Click *Send a related late alert*. "It attaches to the same incident
   and becomes a comment on the same Jira issue. No second ticket." Then *Send an unrelated alert*:
   "Parked as noise."
10. **Close (10s).** Overview -> Loghub BGL: "Same idea on 9,695 real alerts, 114 incidents."
    Evaluation page: "Measured against ground truth: 1 of 1 incidents, 100% pair precision."

If something breaks: *Replay golden incident* on the Evaluation page resets the engine state.

Note: after a late alert the severity can drop (the trend factor reads "decaying" once the burst
ends). That is the model working as designed; the re-score is recorded in the history.
