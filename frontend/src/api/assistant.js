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
