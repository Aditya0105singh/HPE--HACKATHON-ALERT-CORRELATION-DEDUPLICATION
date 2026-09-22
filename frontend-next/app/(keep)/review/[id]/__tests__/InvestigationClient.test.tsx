import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { useApi } from "@/shared/lib/hooks/useApi";
import InvestigationClient from "../InvestigationClient";
import { draftDetail, evidence } from "@/entities/engine/__fixtures__/engine";

// This file's own session mock takes over from shared/tests/next-auth-mock.ts
// (loaded globally in jest.setup.ts) so the "missing reviewer" validation
// path — unreachable under the global mock's fixed "Test User" — is testable.
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// react-toastify renders into a portal that needs a mounted <ToastContainer/>
// to appear in the DOM at all; asserting on the mock call is what every
// caller here actually controls, and is what other suites in this repo do
// for library-rendered UI they don't own.
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

const DRAFT_ID = "draft-0-123";

function withFreshSWR(children: React.ReactNode) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function mockApi(routes: Record<string, unknown>, post?: jest.Mock) {
  (useApi as jest.Mock).mockReturnValue({
    request: jest.fn(),
    get: jest.fn((url: string) => {
      if (url in routes) return Promise.resolve(routes[url]);
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: post ?? jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    isReady: () => true,
  });
}

function baseRoutes(overrides: { draft?: Partial<Parameters<typeof draftDetail>[0]>; evidenceOverrides?: Parameters<typeof evidence>[0] } = {}) {
  return {
    [`/engine/queue/${DRAFT_ID}/evidence`]: evidence(overrides.evidenceOverrides),
    [`/engine/queue/${DRAFT_ID}`]: draftDetail(overrides.draft),
    "/engine/audit": [],
    "/engine/feedback": { decisions: [], patterns: [] },
  };
}

function renderPage(routes: Record<string, unknown>, opts: { sessionName?: string | null; post?: jest.Mock } = {}) {
  (useSession as jest.Mock).mockReturnValue({
    data: opts.sessionName === null ? null : { user: { name: opts.sessionName ?? "Test User" } },
  });
  mockApi(routes, opts.post);
  return render(withFreshSWR(<InvestigationClient draftId={DRAFT_ID} />));
}

describe("InvestigationClient — empty and loading states", () => {
  it("shows a way back to Overview when there is no incident to investigate", async () => {
    // No route registered for the evidence GET, so mockApi's fetcher rejects,
    // exercising the same "no evidence" path a fresh/empty engine state hits.
    renderPage({});

    expect(await screen.findByText("No incident to investigate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to overview/i })).toHaveAttribute("href", "/");
  });
});

describe("InvestigationClient — funnel and header", () => {
  it("shows the raw -> unique -> incident funnel and the rejected count from real evidence numbers", async () => {
    renderPage(baseRoutes());
    // raw_signals=17, unique_signals=6 -> 11 repeats collapsed; excluded.length=1
    expect(await screen.findByText("11 repeats collapsed")).toBeInTheDocument();
    expect(screen.getByText("root cause postgres-primary")).toBeInTheDocument();
    expect(screen.getByText("shared no context")).toBeInTheDocument();

    const rejectedLabel = screen.getByText("rejected");
    const rejectedBlock = rejectedLabel.parentElement as HTMLElement;
    expect(within(rejectedBlock).getByText("1")).toBeInTheDocument();
  });

  it("shows the draft's priority and review status in the hero", async () => {
    renderPage(baseRoutes({ draft: { priority: "P1", status: "awaiting_review" } }));
    const status = await screen.findByText("Awaiting human review");
    const hero = status.closest("div.relative") as HTMLElement;
    expect(within(hero).getByText("P1")).toBeInTheDocument();
  });
});

describe("InvestigationClient — Correlation Explorer", () => {
  it("shows why each signal joined, including a repeated-signal badge", async () => {
    renderPage(baseRoutes());
    expect(await screen.findByText("×12 collapsed into 1")).toBeInTheDocument();
    expect(screen.getByText("root-cause signal")).toBeInTheDocument();
    expect(screen.getAllByText(/Same service|Dependency link/).length).toBeGreaterThan(0);
  });

  it("lists a rejected signal with its failed checks and the reason, under Considered and rejected", async () => {
    renderPage(baseRoutes());
    const heading = await screen.findByText("Considered and rejected");
    const section = heading.parentElement as HTMLElement;
    expect(within(section).getByText("REJECTED FROM INCIDENT")).toBeInTheDocument();
    expect(within(section).getByText("log-archive")).toBeInTheDocument();
    expect(within(section).getByText(/no shared service, dependency edge, or trace id/)).toBeInTheDocument();
  });
});

describe("InvestigationClient — root cause, severity, confidence, history", () => {
  it("ranks the root cause above its rejected symptom, with the counterfactual note", async () => {
    renderPage(baseRoutes());
    expect(await screen.findByText("Counterfactual check (graph ablation)")).toBeInTheDocument();
    expect(screen.getByText("SYMPTOM")).toBeInTheDocument();
    expect(screen.getByText(/rejected by counterfactual/)).toBeInTheDocument();
  });

  it("shows the priority, score and every weighted factor's contribution", async () => {
    renderPage(baseRoutes());
    expect(await screen.findByText("Severity — why this priority")).toBeInTheDocument();
    expect(screen.getByText("0.846")).toBeInTheDocument();
    expect(screen.getByText("≥ 0.75 → P1")).toBeInTheDocument();
    // business criticality: weight 0.3 * value 1.0 = +0.30
    expect(screen.getByText("+0.30")).toBeInTheDocument();
    expect(screen.getByText(/blast radius/i)).toBeInTheDocument();
  });

  it("shows a historical match with its resolution when the draft has one", async () => {
    renderPage(
      baseRoutes({
        draft: {
          historical_match: {
            incident_id: "INC-0417", title: "Pool exhaustion", similarity_pct: 90,
            resolution: "Raised the pool size", resolution_minutes: 34, shared_terms: ["pool", "connection"], source: "seeded demo history",
          },
        },
      })
    );
    expect(await screen.findByText("INC-0417")).toBeInTheDocument();
    expect(screen.getByText("90% similar")).toBeInTheDocument();
    expect(screen.getByText(/Raised the pool size/)).toBeInTheDocument();
  });

  it("reports a novel incident honestly when there is no historical match", async () => {
    renderPage(baseRoutes({ draft: { historical_match: null } }));
    expect(await screen.findByText(/novel incident/i)).toBeInTheDocument();
  });
});

describe("InvestigationClient — the review gate", () => {
  it("shows AWAITING HUMAN REVIEW and no Jira key before approval", async () => {
    renderPage(baseRoutes({ draft: { status: "awaiting_review", jira_key: null } }));
    expect(await screen.findByText("AWAITING HUMAN REVIEW")).toBeInTheDocument();
    expect(screen.getByText(/Jira issue NOT created/)).toBeInTheDocument();
  });

  it("shows the computed-facts / AI-generated split, and that the LLM cannot add facts", async () => {
    renderPage(baseRoutes());
    const heading = await screen.findByText("Ticket draft — what the engineer will receive");
    const ticketCard = heading.closest("section") as HTMLElement;
    // Many cards on the page carry a "Computed" tag; scope to the ticket card
    // itself to check it has both halves of the computed/AI split.
    expect(within(ticketCard).getByText("Computed")).toBeInTheDocument();
    expect(within(ticketCard).getByText("AI-generated")).toBeInTheDocument();
    expect(within(ticketCard).getByText(/cannot add services, timestamps, severity or a root cause/)).toBeInTheDocument();
  });

  it("refuses to approve without a reviewer name", async () => {
    const post = jest.fn();
    renderPage(baseRoutes(), { sessionName: null, post });
    await screen.findByText("AWAITING HUMAN REVIEW");

    fireEvent.click(screen.getByRole("button", { name: /approve & create jira/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Enter a reviewer name — approval requires a named human")
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("approving with a reviewer name posts to the approve endpoint with that actor", async () => {
    const post = jest.fn().mockResolvedValue(draftDetail({ status: "published", jira_key: "AIOPS-1" }));
    renderPage(baseRoutes(), { post });
    await screen.findByText("AWAITING HUMAN REVIEW");

    const input = screen.getByLabelText("Reviewer name");
    fireEvent.change(input, { target: { value: "Aditya Singh" } });
    fireEvent.click(screen.getByRole("button", { name: /approve & create jira/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/engine/queue/${DRAFT_ID}/approve`, { actor: "Aditya Singh" })
    );
  });

  it("shows the published state, its Jira key and the approval guarantees once published", async () => {
    renderPage(baseRoutes({ draft: { status: "published", jira_key: "AIOPS-1", reviewer: "Aditya Singh" } }));
    expect(await screen.findByText("PUBLISHED as AIOPS-1")).toBeInTheDocument();
    expect(screen.getByText(/Human approval recorded \(Aditya Singh\)/)).toBeInTheDocument();
    expect(screen.getByText(/Single-use approval token minted/)).toBeInTheDocument();
    expect(screen.getByText(/Jira issue created once/)).toBeInTheDocument();
  });

  it("rejecting posts to the reject endpoint with a note", async () => {
    const post = jest.fn().mockResolvedValue(draftDetail({ status: "rejected" }));
    renderPage(baseRoutes(), { post });
    await screen.findByText("AWAITING HUMAN REVIEW");

    fireEvent.click(screen.getByRole("button", { name: /reject as noise/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/engine/queue/${DRAFT_ID}/reject`, { actor: "Test User", note: "rejected as noise" })
    );
  });
});

describe("InvestigationClient — stateful incident controls", () => {
  it("late-arrival buttons are enabled while awaiting review", async () => {
    renderPage(baseRoutes({ draft: { status: "awaiting_review" } }));
    const button = await screen.findByRole("button", { name: /send a related late alert/i });
    expect(button).not.toBeDisabled();
  });

  it("late-arrival buttons stay enabled after publish but the resolve button appears", async () => {
    renderPage(baseRoutes({ draft: { status: "published", jira_key: "AIOPS-1" } }));
    expect(await screen.findByRole("button", { name: /send a related late alert/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /mark resolved/i })).toBeInTheDocument();
  });

  it("sending a related late alert calls the late-signal endpoint with kind=matching", async () => {
    const post = jest.fn().mockResolvedValue({ attached: true, gate: "same service", draft_id: DRAFT_ID, incidents: 1 });
    renderPage(baseRoutes(), { post });
    fireEvent.click(await screen.findByRole("button", { name: /send a related late alert/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/engine/queue/${DRAFT_ID}/late-signal`, { kind: "matching" })
    );
  });
});
