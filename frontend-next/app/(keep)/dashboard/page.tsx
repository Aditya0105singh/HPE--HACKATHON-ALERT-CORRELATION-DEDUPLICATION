import { redirect } from "next/navigation";
import { DASHBOARDS } from "@/mocks/keepMockData";

export const metadata = {
  title: "Dashboard | AlertLens",
};

/**
 * Keep only ships /dashboard/[id]; its navbar links straight to a dashboard.
 * The AlertLens nav has a plain "Dashboard" entry, so send it to the first one.
 */
export default function DashboardIndexPage() {
  redirect(`/dashboard/${DASHBOARDS[0]?.id ?? "dash-1"}`);
}
