import { PageHero } from "@/shared/ui";
import { LuGauge } from "react-icons/lu";
import { IncidentPicker } from "@/entities/alertlens/ui/IncidentPicker";

export const metadata = {
  title: "Forecast | AlertLens",
};

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHero
        icon={LuGauge}
        title="Blast Radius Forecast"
        subtitle="Predicts how far an incident will spread if left unhandled. Choose an incident to forecast."
      />
      <IncidentPicker
        basePath="/forecast"
        emptyTitle="No incidents to forecast"
      />
    </div>
  );
}
