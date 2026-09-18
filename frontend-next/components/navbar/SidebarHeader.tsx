import Link from "next/link";
import { AlertLensMark } from "@/components/AlertLensMark";

/** Logo + tagline pinned at the top of the sidebar, above the nav list. */
export const SidebarHeader = () => (
  <Link
    href="/"
    className="flex items-center gap-2.5 px-3 pt-4 pb-3 group"
    data-testid="sidebar-logo"
  >
    <AlertLensMark className="w-7 h-7 shrink-0" />
    <div className="min-w-0">
      <div className="text-[15px] font-bold text-gray-900 leading-tight truncate">
        AlertLens
      </div>
      <div className="text-[11px] text-gray-400 leading-tight truncate">
        From alerts to actions
      </div>
    </div>
  </Link>
);
