import { PageSubtitle, PageTitle } from "@/shared/ui";
import { LuGauge } from "react-icons/lu";
import { IncidentPicker } from "@/entities/alertlens/ui/IncidentPicker";

export const metadata = {
  title: "Forecast | AlertLens",
};

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <PageTitle>Blast Radius Forecast</PageTitle>
        <PageSubtitle>
          Predicts how far an incident will spread if left unhandled. Choose an
          incident to forecast.
        </PageSubtitle>
      </div>
      <IncidentPicker
        basePath="/forecast"
        icon={LuGauge}
        emptyTitle="No incidents to forecast"
      />
    </div>
  );
}
