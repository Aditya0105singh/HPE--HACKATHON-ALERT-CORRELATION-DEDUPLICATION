"use client";

import Link from "next/link";
import { Session } from "next-auth";
import { HiOutlineBell, HiOutlineCheckCircle } from "react-icons/hi2";
import { Search } from "@/components/navbar/Search";
import { UserInfo } from "@/components/navbar/UserInfo";
import { useSettingsStatus, useNotificationLog } from "@/entities/alertlens";

/**
 * Horizontal bar above the page content: search, real pipeline-health status,
 * a real notification count, and the user menu. Only spans the main content
 * column - the sidebar (logo + nav) lives to its left, unaffected.
 */
export function Topbar({ session }: { session: Session | null }) {
  const { data: status } = useSettingsStatus();
  const { data: notifications } = useNotificationLog();

  // "Healthy" is a real read on the pipeline, not a decoration: a dataset is
  // loaded and it actually produced persisted alerts. Anything else is
  // reported honestly as not-yet-loaded rather than a green pill that lies.
  const healthy = !!status && status.dataset !== "none" && status.persisted_alert_count > 0;
  const failedCount = (notifications ?? []).filter((n) => n.status === "failed").length;
  const bellCount = notifications?.length ?? 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="flex-1 min-w-0 max-w-md">
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
          href="/notifications-hub"
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 hover:text-green-700 transition-colors"
          title={`${bellCount} notification(s)${failedCount ? `, ${failedCount} failed` : ""}`}
        >
          <HiOutlineBell size={18} />
          {bellCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: failedCount > 0 ? "#dc2626" : "#15803d" }}
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
