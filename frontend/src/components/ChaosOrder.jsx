import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dna, Play } from "lucide-react";

const PALETTE = ["#40c057", "#339af0", "#fab005", "#e64980", "#7950f2", "#15aabf"];
const SEV_COLOR = { critical: "#f0384e", high: "#f59f00", info: "#339af0" };
const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

// Deterministic pseudo-random from a string, so scatter positions are stable
// across re-renders but different per alert.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function ChaosOrder({ data, live = false }) {
  const clusters = data?.clusters ?? [];
  const noise = data?.noise ?? [];
  const rawCount = data?.dedup_stats?.raw_count ?? 0;

  // scatter → shake → collapse → reveal
  const [phase, setPhase] = useState("scatter");
  const [counter, setCounter] = useState(rawCount);
  const timers = useRef([]);
  const raf = useRef(null);

  const dots = useMemo(() => {
    const out = [];
    clusters.forEach((c, ci) => {
      const cx = ((ci + 1) / (clusters.length + 1)) * 100;
      c.alerts.forEach((a, i) => {
        const angle = (i / c.alerts.length) * Math.PI * 2 - Math.PI / 2;
        out.push({
          id: a.id,
          sev: a.severity,
          sx: 4 + ((hash(a.id) % 9000) / 9000) * 92,
          sy: 6 + ((hash(a.id + "y") % 9000) / 9000) * 74,
          tx: cx + Math.cos(angle) * 4.2,
          ty: 36 + Math.sin(angle) * 10,
          color: PALETTE[c.cluster_id % PALETTE.length],
        });
      });
    });
    noise.forEach((a, i) => {
      out.push({
        id: a.id,
        sev: a.severity,
        sx: 4 + ((hash(a.id) % 9000) / 9000) * 92,
        sy: 6 + ((hash(a.id + "y") % 9000) / 9000) * 74,
        tx: 6 + (i / Math.max(noise.length - 1, 1)) * 88,
        ty: 88,
        color: "#3f454e",
      });
    });
    return out;
  }, [clusters, noise]);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  const play = useCallback(() => {
    clearAll();
    setPhase("scatter");
    setCounter(rawCount);
    const t = (ms, fn) => timers.current.push(setTimeout(fn, ms));

    t(150, () => setPhase("shake"));
    t(1100, () => {
      setPhase("collapse");
      // tick the counter down while dots fly
      const start = performance.now();
      const dur = 1500;
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const v = Math.round(rawCount - (rawCount - clusters.length) * easeOutCubic(p));
        setCounter(v);
        if (p < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    });
    t(2800, () => setPhase("reveal"));
  }, [clearAll, rawCount, clusters.length]);

  useEffect(() => {
    if (live) {
      // storm replay in progress: show clusters forming in place — no
      // scripted animation, the storm itself is the animation
      clearAll();
      setPhase("reveal");
      setCounter(clusters.length);
      return clearAll;
    }
    const id = setTimeout(play, 500);
    return () => {
      clearTimeout(id);
      clearAll();
    };
  }, [play, clearAll, live, clusters.length]);

  const settled = phase === "collapse" || phase === "reveal";
  const reduction = rawCount ? (100 * (1 - clusters.length / rawCount)).toFixed(1) : 0;

  return (
    <div
      className="relative rounded-lg border overflow-hidden select-none"
      style={{ borderColor: "var(--border)", background: "var(--panel)", height: 560 }}
    >
      {/* headline counter */}
      <div className="absolute top-5 left-0 right-0 text-center z-10 pointer-events-none">
        <div className="text-5xl font-bold tabular-nums" style={{ color: settled ? "var(--accent)" : "var(--text)" }}>
          {counter}
        </div>
        <div className="text-[15px] mt-1 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {phase === "reveal" ? "actionable incidents" : settled ? "correlating…" : "raw alerts flooding in"}
        </div>
        {phase === "reveal" && (
          <div className="text-[17px] mt-2 font-semibold" style={{ color: "var(--ok)" }}>
            {reduction}% noise reduction — {rawCount} alerts → {clusters.length} root causes
          </div>
        )}
      </div>

      {/* replay */}
      <button
        onClick={play}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[15px] font-semibold cursor-pointer border"
        style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <Play size={13} strokeWidth={2} fill="currentColor" /> Replay
      </button>

      {/* dots */}
      {dots.map((d, i) => (
        <div
          key={d.id}
          className={phase === "shake" ? "dot-shake" : ""}
          style={{
            position: "absolute",
            left: `${settled ? d.tx : d.sx}%`,
            top: `${settled ? d.ty : d.sy}%`,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
            borderRadius: "50%",
            background: settled ? d.color : SEV_COLOR[d.sev] || "#888",
            boxShadow: settled
              ? `0 0 10px ${d.color}55`
              : `0 0 8px ${(SEV_COLOR[d.sev] || "#888")}66`,
            transition: settled
              ? `left 1.4s cubic-bezier(.22,1,.36,1) ${(i % 12) * 55}ms, top 1.4s cubic-bezier(.22,1,.36,1) ${(i % 12) * 55}ms, background 1.2s, box-shadow 1.2s`
              : "none",
          }}
        />
      ))}

      {/* cluster labels — appear on reveal */}
      {phase === "reveal" &&
        clusters.map((c, ci) => {
          const cx = ((ci + 1) / (clusters.length + 1)) * 100;
          return (
            <div
              key={c.cluster_id}
              className="absolute z-10 w-56 rounded-md border p-2.5 text-center animate-[fadein_.6s_ease]"
              style={{
                left: `${cx}%`,
                top: "54%",
                transform: "translateX(-50%)",
                background: "var(--panel-2)",
                borderColor: "var(--border)",
              }}
            >
              <div className="text-[14px] font-semibold truncate">
                {c.root_cause.service} / {c.root_cause.alertname}
              </div>
              <div className="text-[13px] mt-0.5 font-semibold uppercase" style={{ color: RISK_COLOR[c.risk.level] }}>
                {c.risk.level} escalation risk
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>
                {c.raw_alert_count} alerts → 1 incident
                {c.dna_match && (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--accent)" }}> · <Dna size={11} strokeWidth={2} /> {c.dna_match.incident_id}</span>
                )}
              </div>
            </div>
          );
        })}

      {/* noise strip label */}
      {phase === "reveal" && noise.length > 0 && (
        <div
          className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-wider animate-[fadein-plain_.6s_ease]"
          style={{ top: "93%", color: "var(--muted)" }}
        >
          {noise.length} uncorrelated background alerts — kept out, not force-grouped
        </div>
      )}
    </div>
  );
}
