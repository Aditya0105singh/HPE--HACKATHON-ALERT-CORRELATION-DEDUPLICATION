"use client";

import {
  WorkflowBuilderWidget,
  WorkflowBuilderWidgetProps,
} from "./workflow-builder-widget";

/**
 * Upstream wrapped the builder in a CopilotKit provider when an OpenAI key was
 * configured. AlertLens has its own assistant and no CopilotKit runtime, so
 * this now renders the builder directly.
 */
export function WorkflowBuilderWidgetSafe(props: WorkflowBuilderWidgetProps) {
  return <WorkflowBuilderWidget {...props} />;
}
