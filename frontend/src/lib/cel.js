// Minimal CEL-lite evaluator for the Feed filter bar.
// Supports: field.contains("x"), field == "x", field != "x", combined with
// && / || (|| has lowest precedence), plus bare-keyword substring fallback.

const FIELDS = ["service", "alertname", "message", "severity", "status", "source", "assignee", "id"];

function evalAtom(atom, alert) {
  atom = atom.trim();
  if (!atom) return true;

  let m = atom.match(/^(\w+)\.contains\(\s*["'](.*)["']\s*\)$/);
  if (m) {
    const [, field, needle] = m;
    if (!FIELDS.includes(field)) return false;
    return String(alert[field] ?? "").toLowerCase().includes(needle.toLowerCase());
  }

  m = atom.match(/^(\w+)\s*(==|!=)\s*["'](.*)["']$/);
  if (m) {
    const [, field, op, value] = m;
    if (!FIELDS.includes(field)) return false;
    const eq = String(alert[field] ?? "").toLowerCase() === value.toLowerCase();
    return op === "==" ? eq : !eq;
  }

  const bare = atom.replace(/^["']|["']$/g, "").toLowerCase();
  const haystack = FIELDS.map((f) => alert[f]).join(" ").toLowerCase();
  return haystack.includes(bare);
}

export function matchesCel(alert, expr) {
  const trimmed = expr.trim();
  if (!trimmed) return true;
  return trimmed.split("||").some((orPart) => orPart.split("&&").every((atom) => evalAtom(atom, alert)));
}
