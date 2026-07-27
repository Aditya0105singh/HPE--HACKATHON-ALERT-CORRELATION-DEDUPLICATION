import { Card, Icon, Metric, Text } from "@tremor/react";
import type { IconType } from "react-icons/lib";
import clsx from "clsx";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: IconType | React.ElementType;
  color?: "orange" | "red" | "blue" | "emerald" | "amber" | "gray";
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  color = "orange",
  className,
}: StatCardProps) {
  return (
    <Card className={clsx("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Text className="truncate">{label}</Text>
          <Metric className="mt-1 text-2xl">{value}</Metric>
        </div>
        {icon && <Icon icon={icon} color={color} variant="light" size="sm" />}
      </div>
      {hint && (
        <Text className="mt-2 text-xs text-gray-500 line-clamp-2">{hint}</Text>
      )}
    </Card>
  );
}
