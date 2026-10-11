import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OptionsFit } from "@/components/studio/views/OptionsFit";
import { useStudio } from "@/lib/studio-store";
import type { Architecture, OptionAnalysis, Project } from "@/lib/types";
import { ARCH } from "./fixtures";

const opt = (id: string, label: string, name: string): Architecture => ({ ...ARCH, id, name: `Option ${label} · ${name}`, meta: { ...ARCH.meta, label } });
const crit = (score: number, evidence: string) => [
  { id: "minimize-downtime", name: "Minimize downtime", priority: "high" as const, score, evidence, baseline: false },
  { id: "avoid-lock-in", name: "Avoid vendor lock-in", priority: "low" as const, score: 1, evidence: "Proprietary services.", baseline: true },
];
const analysis: OptionAnalysis = {
  fits: [
    { option_id: "a", label: "A", name: "Option A · GCP + Databricks", variant: "requested", summary: "As requested.", fit_percent: 82, criteria: crit(3, "Continuous CDC."), strengths: [], trade_offs: [], component_count: 19, high_findings: 2 },
    { option_id: "b", label: "B", name: "Option B · GCP + BigQuery", variant: "platform:bigquery", summary: "Alternative platform.", fit_percent: 74, criteria: crit(2, "Datastream CDC."), strengths: [], trade_offs: [], component_count: 17, high_findings: 3 },
  ],
  recommended_option_id: "a", headline: "Option A best matches your stated priorities (82% fit).", rationale: "Continuous CDC keeps cutover short.",
  choose_when: { a: "When downtime matters most.", b: "When a serverless SQL warehouse is preferred." }, caveats: ["Scores reflect stated priorities only."],
  decided_by: "rules+ai:qwen3:4b", priorities_assumed: false,
};

describe("OptionsFit", () => {
  it("shows the best-fit recommendation, per-priority evidence and when to choose each option", () => {
    const project = { id: "p", name: "P", description: "", estate: { description: "", current_technologies: [], target_platforms: [], constraints: [], notes: [], retain_technologies: [], exclude_technologies: [] },
      options: [opt("a", "A", "GCP + Databricks"), opt("b", "B", "GCP + BigQuery")], active_option_id: "a", option_analysis: analysis,
      risks: [], decisions: [], knowledge_sources: [], conversations: [], created_at: "", updated_at: "" } as Project;
    useStudio.setState({ project, activeId: "a" });
    render(<OptionsFit />);
    expect(screen.getByText("Best fit for your priorities")).toBeInTheDocument();
    expect(screen.getByText(/Local AI \+ rules/)).toBeInTheDocument();
    expect(screen.getByText("Continuous CDC.")).toBeInTheDocument();
    expect(screen.getByText("baseline · not stated")).toBeInTheDocument();
    expect(screen.getByText("When a serverless SQL warehouse is preferred.")).toBeInTheDocument();
    expect(screen.getAllByText("82%").length).toBeGreaterThan(0);
  });

  it("offers to generate alternatives when there is only one option", () => {
    useStudio.setState({ project: { ...(useStudio.getState().project as Project), options: [opt("a", "A", "GCP + Databricks")], option_analysis: null } });
    render(<OptionsFit />);
    expect(screen.getByText("Generate alternatives")).toBeInTheDocument();
  });
});
