export async function fetchPipeline() {
  const res = await fetch("/api/pipeline");
  if (!res.ok) throw new Error(`pipeline fetch failed: ${res.status}`);
  return res.json();
}

export async function loadDemoBatch({ seed = null, scenario = null } = {}) {
  const params = new URLSearchParams();
  if (seed != null) params.set("seed", seed);
  if (scenario) params.set("scenario", scenario);
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`/api/demo/load${qs}`, { method: "POST" });
  if (!res.ok) throw new Error(`demo load failed: ${res.status}`);
  return res.json();
}

export async function loadRealBatch() {
  const res = await fetch("/api/demo/load-real", { method: "POST" });
  if (!res.ok) throw new Error(`real data load failed: ${res.status}`);
  return res.json();
}

export async function loadAiopsBatch() {
  const res = await fetch("/api/demo/load-aiops", { method: "POST" });
  if (!res.ok) throw new Error(`aiops data load failed: ${res.status}`);
  return res.json();
}

export async function fetchEvaluation() {
  const res = await fetch("/api/evaluation");
  if (!res.ok) throw new Error(`evaluation fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchForecast(incidentId) {
  const res = await fetch(`/api/forecast/${incidentId}`);
  if (!res.ok) throw new Error(`forecast fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchIncidentComparison(incidentId) {
  const res = await fetch(`/api/incidents/${incidentId}/comparison`);
  if (!res.ok) throw new Error(`incident comparison fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRootCauseConfidence(incidentId) {
  const res = await fetch(`/api/incidents/${incidentId}/root_cause_confidence`);
  if (!res.ok) throw new Error(`root cause confidence fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPlaybook(incidentId) {
  const res = await fetch(`/api/incidents/${incidentId}/playbook`);
  if (!res.ok) throw new Error(`playbook fetch failed: ${res.status}`);
  return res.json();
}
