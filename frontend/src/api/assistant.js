export async function askIncidentAssistant(payload) {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `assistant request failed: ${res.status}`);
  }
  return data;
}

/**
 * Global workspace-aware assistant.
 * payload: { question, conversation?, incident_id?, workspace_context? }
 * - When incident_id is provided the backend delegates to incident mode.
 * - Otherwise the backend builds a live pipeline snapshot as context.
 */
export async function askWorkspaceAssistant(payload) {
  const res = await fetch("/api/assistant/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `workspace assistant request failed: ${res.status}`);
  }
  return data;
}
