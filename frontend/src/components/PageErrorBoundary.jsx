import { Component } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

// Without this, an uncaught render error on any single route (a null field
// in a particular alert batch, a race with an in-flight data refresh, a
// cold-start response shaped slightly differently than expected) unmounts
// the entire React tree by default — sidebar and top bar included — which
// is what reads as the whole app "going black". Scoping the boundary around
// just the routed page keeps navigation alive and shows a recoverable
// fallback instead of a blank screen.
export default class PageErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[PageErrorBoundary] route render crashed:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div
          className="max-w-md w-full rounded-xl border p-6 text-center"
          style={{ background: "var(--panel)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--critical) 15%, transparent)", color: "var(--critical)" }}
          >
            <TriangleAlert size={20} strokeWidth={2.25} />
          </div>
          <div className="font-semibold text-[15px] mb-1.5">This page hit an error</div>
          <div className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
            The rest of the dashboard is still up — navigation and your data are unaffected. Reloading this view usually clears it.
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold cursor-pointer grad-btn"
          >
            <RefreshCw size={13} strokeWidth={2.25} />
            Retry this page
          </button>
        </div>
      </div>
    );
  }
}
