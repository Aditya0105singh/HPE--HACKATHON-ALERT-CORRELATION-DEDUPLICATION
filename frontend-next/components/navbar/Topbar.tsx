"use client";

import Link from "next/link";
import { Session } from "next-auth";
import { HiOutlineBell, HiOutlineCheckCircle } from "react-icons/hi2";
import { Search } from "@/components/navbar/Search";
import { UserInfo } from "@/components/navbar/UserInfo";
import { useSettingsStatus } from "@/entities/alertlens";
import { useEngineQueue } from "@/entities/engine/useEngine";

/**
 * Horizontal bar above the page content: search, real pipeline-health status,
 * a real notification count, and the user menu. Only spans the main content
 * column - the sidebar (logo + nav) lives to its left, unaffected.
 */
export function Topbar({ session }: { session: Session | null }) {
  const { data: status } = useSettingsStatus();
  const { data: queue } = useEngineQueue();

  // "Healthy" is a real read on the pipeline, not a decoration: a dataset is
  // loaded and it actually produced persisted alerts. Anything else is
  // reported honestly as not-yet-loaded rather than a green pill that lies.
  const healthy = !!status && status.dataset !== "none" && status.persisted_alert_count > 0;
  // The bell counts drafts waiting for a human decision: the one number an
  // on-call reviewer actually needs, and it clears itself as they are decided.
  const bellCount = (queue ?? []).filter((q) => q.status === "awaiting_review").length;

  return (
    // .page-container pads its scroll area by 16px (24px on xl), so a plain
    // `sticky top-0` sticks below that padding and page content shows through
    // the strip above the bar. The negative margin/top pull the bar over the
    // padding; the extra top padding keeps its contents where they were.
    <div className="flex items-center gap-3 px-4 pb-2 pt-6 xl:pt-8 -mt-4 xl:-mt-6 -top-4 xl:-top-6 border-b border-gray-200/70 bg-white/90 backdrop-blur-md sticky z-20">
      <div className="flex-1 min-w-0 max-w-xl">
        <Search />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Link
          href="/settings"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          style={
            healthy
              ? { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" }
              : { borderColor: "#e5e7eb", background: "#f9fafb", color: "#6b7280" }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: healthy ? "#22c55e" : "#9ca3af" }}
          />
          {healthy ? "Pipeline healthy" : "No data loaded"}
        </Link>

        <Link
          href="/review"
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 hover:text-green-700 transition-colors"
          title={`${bellCount} incident draft(s) awaiting human review`}
        >
          <HiOutlineBell size={18} />
          {bellCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: "#15803d" }}
            >
              {bellCount > 99 ? "99+" : bellCount}
            </span>
          )}
        </Link>

        <div className="pl-1">
          <UserInfo session={session} inline />
        </div>
      </div>
    </div>
  );
}
