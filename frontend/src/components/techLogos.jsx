// Real brand logos for infrastructure/tooling that actually has one —
// e.g. the Postgres elephant, the Kafka mark, the Redis logo. Purely
// generic services (api-gateway, checkout-service, worker-node-3, ...)
// have no real-world logo, so they fall back to a generic concept icon.
import {
  SiApachekafka, SiDatadog, SiGooglecloud, SiGrafana, SiKubernetes,
  SiPostgresql, SiPrometheus, SiRedis,
} from "react-icons/si";

// [substring to match against service name, Icon, brand color]
const TECH_RULES = [
  ["postgres", SiPostgresql, "#336791"],
  ["kafka", SiApachekafka, "#e8e8e8"],
  ["redis", SiRedis, "#DC382D"],
  ["k8s", SiKubernetes, "#326CE5"],
  ["kube", SiKubernetes, "#326CE5"],
];

export function techLogoFor(service) {
  if (!service) return null;
  const s = service.toLowerCase();
  const match = TECH_RULES.find(([k]) => s.includes(k));
  return match ? { Icon: match[1], color: match[2] } : null;
}

export const SOURCE_LOGO = {
  prometheus: { Icon: SiPrometheus, color: "#E6522C" },
  datadog: { Icon: SiDatadog, color: "#632CA6" },
  grafana: { Icon: SiGrafana, color: "#F46800" },
  "gcp-monitoring": { Icon: SiGooglecloud, color: "#4285F4" },
};
