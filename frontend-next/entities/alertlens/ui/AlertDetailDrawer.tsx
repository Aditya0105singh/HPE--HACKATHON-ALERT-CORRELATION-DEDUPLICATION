"use client";

import { useState } from "react";
import { Badge, Button, Text, Title } from "@tremor/react";
import { Drawer } from "@/shared/ui/Drawer";
import { SeverityLabel, showErrorToast, showSuccessToast } from "@/shared/ui";
import type { UISeverity } from "@/shared/ui";
import { useAlertActions } from "@/entities/alertlens";
import type { Alert } from "@/entities/alertlens";
import { formatTimestamp, timeAgo } from "@/entities/alertlens/lib/format";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <Text className="text-xs uppercase tracking-wide text-gray-500">
      {label}
    </Text>
    <div className="text-sm">{children}</div>
  </div>
);

export function AlertDetailDrawer({
  alert,
  onClose,
}: {
  alert: Alert | null;
  onClose: () => void;
}) {
  const { ackAlert, assignAlert, dismissAlert, escalateAlert } =
    useAlertActions();
  const [busy, setBusy] = useState<string | null>(null);

  if (!alert) return null;

  // Each action replays the batch server-side, so the drawer closes and the
  // whole pipeline revalidates rather than trying to patch this row locally.
  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try {
      await fn();
      showSuccessToast(`${name} applied`);
      onClose();
    } catch (e) {
      showErrorToast(e, `Could not ${name.toLowerCase()} this alert`);
    } finally {
      setBusy(null);
    }
  };

  const isAcked = Boolean(alert.acked);
  const isEscalated = Boolean(alert.escalated);
  const assignee =
    alert.assignee && alert.assignee !== "n/a" ? alert.assignee : null;

  return (
    <Drawer isOpen={!!alert} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Title className="truncate">{alert.alertname}</Title>
            <Text className="text-gray-500">{alert.service}</Text>
          </div>
          <SeverityLabel severity={alert.severity as UISeverity} />
        </div>

        <Text>{alert.message}</Text>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <Badge size="xs" color="gray">
              {alert.status}
            </Badge>
          </Field>
          <Field label="Source">{alert.source}</Field>
          <Field label="Received">
            <span title={formatTimestamp(alert.timestamp)}>
              {timeAgo(alert.timestamp)}
            </span>
          </Field>
          {/* Only post-dedup alerts carry these; raw feed rows do not. */}
          {alert.duplicate_count != null && (
            <Field label="Duplicates collapsed">×{alert.duplicate_count}</Field>
          )}
          {alert.fingerprint && (
            <Field label="Fingerprint">
              <span className="font-mono text-xs">{alert.fingerprint}</span>
            </Field>
          )}
          <Field label="Assignee">{assignee ?? "Unassigned"}</Field>
          <Field label="Acknowledged">{isAcked ? "Yes" : "No"}</Field>
          <Field label="Escalated">{isEscalated ? "Yes" : "No"}</Field>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          <Button
            size="xs"
            color="orange"
            variant={isAcked ? "secondary" : "primary"}
            loading={busy === "Acknowledge"}
            onClick={() =>
              run("Acknowledge", () => ackAlert(alert.id, !isAcked))
            }
          >
            {isAcked ? "Un-acknowledge" : "Acknowledge"}
          </Button>
          <Button
            size="xs"
            color="orange"
            variant="secondary"
            loading={busy === "Escalate"}
            onClick={() =>
              run("Escalate", () => escalateAlert(alert.id, !isEscalated))
            }
          >
            {isEscalated ? "De-escalate" : "Escalate"}
          </Button>
          <Button
            size="xs"
            color="orange"
            variant="secondary"
            loading={busy === "Assign"}
            onClick={() =>
              run("Assign", () => assignAlert(alert.id, assignee ? null : "me"))
            }
          >
            {assignee ? "Unassign" : "Assign to me"}
          </Button>
          <Button
            size="xs"
            color="orange"
            variant="secondary"
            loading={busy === "Suppress"}
            onClick={() =>
              run("Suppress", () =>
                dismissAlert(
                  alert.id,
                  alert.status === "suppressed" ? null : "suppressed"
                )
              )
            }
          >
            {alert.status === "suppressed" ? "Un-suppress" : "Suppress"}
          </Button>
          <Button
            size="xs"
            color="orange"
            variant="secondary"
            loading={busy === "Resolve"}
            onClick={() =>
              run("Resolve", () =>
                dismissAlert(
                  alert.id,
                  alert.status === "resolved" ? null : "resolved"
                )
              )
            }
          >
            {alert.status === "resolved" ? "Reopen" : "Resolve"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
