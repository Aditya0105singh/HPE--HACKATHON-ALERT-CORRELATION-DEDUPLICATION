import { render, screen } from "@testing-library/react";
import { WorkflowBuilderWidgetSafe } from "../workflow-builder-widget-safe";
import { WorkflowBuilderWidget } from "../workflow-builder-widget";

// Mock the actual WorkflowBuilderWidget component
jest.mock("../workflow-builder-widget", () => ({
  WorkflowBuilderWidget: jest.fn((props) => (
    <div data-testid="workflow-builder">
      <span>workflowRaw: {props.workflowRaw}</span>
      <span>workflowId: {props.workflowId}</span>
    </div>
  )),
}));

describe("WorkflowBuilderWidgetSafe", () => {
  const mockWorkflowRaw = JSON.stringify({ test: "workflow" });
  const mockWorkflowId = "test-workflow-id";

  beforeEach(() => {
    jest.clearAllMocks();
    (WorkflowBuilderWidget as jest.Mock).mockClear();
  });

  // AlertLens has no CopilotKit runtime, so this renders the builder
  // directly regardless of any AI configuration — see
  // workflow-builder-widget-safe.tsx.
  it("renders WorkflowBuilderWidget with the given props", () => {
    render(
      <WorkflowBuilderWidgetSafe
        workflowRaw={mockWorkflowRaw}
        workflowId={mockWorkflowId}
      />
    );

    expect(WorkflowBuilderWidget).toHaveBeenCalledWith(
      {
        workflowRaw: mockWorkflowRaw,
        workflowId: mockWorkflowId,
      },
      undefined
    );

    expect(screen.getByTestId("workflow-builder")).toBeInTheDocument();
    expect(
      screen.getByText(`workflowRaw: ${mockWorkflowRaw}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`workflowId: ${mockWorkflowId}`)
    ).toBeInTheDocument();
  });
});
