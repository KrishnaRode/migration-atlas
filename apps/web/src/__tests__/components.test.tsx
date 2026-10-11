import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { TechNode } from "@/components/studio/canvas/TechNode";
import { Library } from "@/components/studio/panels/Library";
import { Markdown } from "@/components/studio/panels/Markdown";
import { HealthPanel } from "@/components/studio/panels/ValidationPanel";
import { TECHS } from "./fixtures";

describe("TechNode", () => {
  const props = (overrides = {}) => ({
    id: "n1", type: "tech", selected: false, dragging: false, zIndex: 0, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
    draggable: true, selectable: true, deletable: true,
    data: { arch: { id: "n1", tech_id: "oracle", origin: "ai" as const, replaces: [], environment: "On-Prem", suggested_strategy: "replatform" }, tech: TECHS.oracle, severity: "high" as const, findingCount: 2, ...overrides },
  });
  it("shows name, category, vendor, environment, suggested strategy and findings", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ReactFlowProvider><TechNode {...(props() as any)} /></ReactFlowProvider>);
    expect(screen.getByText("Oracle Database")).toBeInTheDocument();
    expect(screen.getByText("Database · Vendor")).toBeInTheDocument();
    expect(screen.getByText("On-Prem")).toBeInTheDocument();
    expect(screen.getByText("Replatform?")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByLabelText("Added by local AI")).toBeInTheDocument();
  });
});

describe("Library", () => {
  const categories = [{ id: "databases", name: "Databases", icon: "database", color: "#f00" }, { id: "bi", name: "BI", icon: "box", color: "#0f0" }];
  it("filters by search text and scope", () => {
    render(<Library techs={Object.values(TECHS)} categories={categories} onAdd={() => undefined} />);
    expect(screen.getByText("Tableau")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search technologies…"), { target: { value: "oracle" } });
    expect(screen.queryByText("Tableau")).not.toBeInTheDocument();
    expect(screen.getByText("Oracle Database")).toBeInTheDocument();
  });
  it("adds on double-click and is draggable", () => {
    let added = "";
    render(<Library techs={[TECHS.bi]} categories={categories} onAdd={(id) => (added = id)} />);
    const item = screen.getByText("Tableau").closest("[draggable]")!;
    fireEvent.doubleClick(item);
    expect(added).toBe("bi");
  });
});

describe("Markdown", () => {
  it("renders headings, lists, bold and citation chips without HTML injection", () => {
    const { container } = render(<Markdown text={"**Why**\n\n- one [S1]\n- two _(rule engine)_ snake_case_name\n\n<img src=x onerror=alert(1)>"} />);
    expect(container.querySelector("em")?.textContent).toBe("(rule engine)");
    expect(container.textContent).toContain("snake_case_name");
    expect(container.querySelector("strong")?.textContent).toBe("Why");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector(".cite")?.textContent).toBe("S1");
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("HealthPanel", () => {
  it("shows separate dimensions and reveals evidence", () => {
    render(<HealthPanel health={[{ id: "governance", name: "Governance coverage", level: "weak", passed: 0, applicable: 2, summary: "0 of 2",
      evidence: [{ check: "Catalog present", passed: false, detail: "No data catalog." }] }]} />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Governance coverage"));
    expect(screen.getByText("No data catalog.")).toBeInTheDocument();
  });
});
