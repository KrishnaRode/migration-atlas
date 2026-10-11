import { describe, expect, it } from "vitest";
import { computeLanes, layoutArchitecture, NODE_H } from "@/lib/layout";
import { ARCH, TECHS } from "./fixtures";

describe("layoutArchitecture", () => {
  it("places every node and keeps data layers left-to-right", async () => {
    const pos = await layoutArchitecture(ARCH, TECHS);
    expect(Object.keys(pos).sort()).toEqual(ARCH.nodes.map((n) => n.id).sort());
    expect(pos.o.x).toBeLessThan(pos.c.x);
    expect(pos.c.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.q.x);
    expect(pos.q.x).toBeLessThan(pos.t.x);
  });

  it("stacks lake zones vertically in one column", async () => {
    const pos = await layoutArchitecture(ARCH, TECHS);
    expect(pos.l.x).toBe(pos.b.x);
    expect(pos.b.x).toBe(pos.s.x);
    expect(pos.l.y).toBeLessThan(pos.b.y);
    expect(pos.b.y).toBeLessThan(pos.s.y);
  });

  it("puts cross-cutting components in a row below the data flow", async () => {
    const pos = await layoutArchitecture(ARCH, TECHS);
    const dataBottom = Math.max(...["o", "c", "l", "b", "s", "q", "t", "d"].map((id) => pos[id].y + NODE_H));
    expect(pos.u.y).toBeGreaterThan(dataBottom);
  });

  it("computes swimlanes from positions", () => {
    const lanes = computeLanes([
      { id: "a", layer: "sources", x: 0, y: 0 }, { id: "b", layer: "ingestion", x: 400, y: 0 }, { id: "c", layer: "governance", x: 200, y: 300 },
    ]);
    expect(lanes.map((l) => l.label)).toEqual(["sources", "ingestion", "governance"]);
    expect(lanes.find((l) => l.label === "governance")?.orientation).toBe("row");
  });
});
