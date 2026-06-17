import { describe, it, expect } from "vitest";
import { aggregateCells, declaredDimensions } from "../evals/lib/aggregate";
import type { Assertions, Scenario, ScenarioRun } from "../evals/lib/types";

function run(modelId: string, runIndex: number, failDims: string[]): ScenarioRun {
  return {
    scenarioDir: "/tmp/s",
    scenario: { name: "s", tier: 2, requiresModel: true, inputs: ["x"], assertions: {} },
    model: { id: modelId, provider: "p", model: "m" },
    runIndex,
    exitCode: 0,
    events: [],
    stdout: "",
    stderr: "",
    notebookContent: null,
    failures: failDims.map((d) => ({ assertion: d, detail: "", dimension: d as never })),
    durationMs: 1,
  };
}

describe("evals aggregate", () => {
  it("declaredDimensions reflects which assertions a scenario uses", () => {
    const a: Assertions = {
      plan: { routingIn: ["galaxy"], minPendingSteps: 3, mentionsOneOf: ["X"] },
      behavior: { asksClarifyingQuestion: true },
    };
    const s = { name: "s", tier: 2, inputs: ["x"], assertions: a } as Scenario;
    const dims = declaredDimensions(s);
    expect([...dims].sort()).toEqual(["behavior", "routing", "tools", "validity"]);
  });

  it("computes majority verdict per dimension across 3 runs", () => {
    const runs: ScenarioRun[] = [
      run("tacc:x", 0, ["routing"]),
      run("tacc:x", 1, []),
      run("tacc:x", 2, []),
    ];
    // declare routing for the scenario so it's counted
    runs.forEach((r) => (r.scenario.assertions = { plan: { routingIn: ["galaxy"] } }));
    const cells = aggregateCells(runs);
    expect(cells).toHaveLength(1);
    expect(cells[0].dimensions.routing.pass).toBe(2);
    expect(cells[0].dimensions.routing.total).toBe(3);
    expect(cells[0].dimensions.routing.verdict).toBe(true); // 2/3 majority
  });
});
