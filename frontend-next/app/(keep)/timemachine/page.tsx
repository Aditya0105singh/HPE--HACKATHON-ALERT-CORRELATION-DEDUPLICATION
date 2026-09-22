import { PageHero } from "@/shared/ui";
import { TbTimeline } from "react-icons/tb";
import { IncidentPicker } from "@/entities/alertlens/ui/IncidentPicker";

export const metadata = {
  title: "Time Machine | AlertLens",
};

export default function TimeMachinePage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHero
        icon={TbTimeline}
        title="Time Machine"
        subtitle="Compares a live incident against its closest match in the Alert DNA history, so you can reuse what worked last time. Choose an incident."
      />
      <IncidentPicker
        basePath="/timemachine"
        emptyTitle="No incidents to compare"
      />
    </div>
  );
}
