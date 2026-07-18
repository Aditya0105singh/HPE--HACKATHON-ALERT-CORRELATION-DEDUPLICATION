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

export async function fetchEvaluation() {
  const res = await fetch("/api/evaluation");
  if (!res.ok) throw new Error(`evaluation fetch failed: ${res.status}`);
  return res.json();
}
