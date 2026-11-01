import { describe, it, expect, vi } from "vitest";
import {
  createComputerPlanner,
  computerRequestSchema,
  checkedComputerPlan,
} from "../../src/lib/server/computer-actions";
import { MetaClientError } from "../../src/lib/server/meta-client";
import {
  ExplorationError,
  type ExplorationPrincipal,
} from "../../src/lib/server/exploration-types";
const principal: ExplorationPrincipal = {
  kind: "guest",
  id: "a".repeat(64),
  workspaceId: "a".repeat(64),
  generation: "a".repeat(64),
  key: "original-computer-test",
};
const input = {
  history: [],
  goal: "Set the font size to 18",
  app: "Original synthetic settings",
  controls: [
    { id: 0, role: "AXTextField" as const, label: "Font size" },
    { id: 1, role: "AXButton" as const, label: "Apply" },
  ],
};
const typeStep = {
  kind: "type" as const,
  target: 0,
  text: "18",
  key: "" as const,
  effect: "Replace the font size field with 18.",
  consequential: false,
};
const applyStep = {
  kind: "click" as const,
  target: 1,
  text: "",
  key: "" as const,
  effect: "Press Apply so the new size takes effect.",
  consequential: false,
};
const plan = {
  kind: "plan",
  reason: "Set the size field to 18, then apply it.",
  steps: [typeStep, applyStep],
};
const completion = () => ({
  status: "completed" as const,
  tools: [
    {
      type: "function_call" as const,
      name: "propose_plan",
      call_id: "one",
      arguments: JSON.stringify(plan),
      parsedArguments: plan,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50 },
});
function harness() {
  const store = {
      read: vi.fn(async () => ({})),
      mutate: vi.fn(async () => ({})),
    },
    revalidate = vi.fn(async () => {}),
    reserve = vi.fn(async () => "reservation"),
    settle = vi.fn(async () => {}),
    request = vi.fn(async (_request: unknown) => completion());
  return {
    store,
    revalidate,
    reserve,
    settle,
    request,
    run: createComputerPlanner({
      store: store as never,
      revalidate,
      reserve,
      settle,
      request,
      enabled: () => true,
    }),
  };
}
describe("scoped Muse computer proposals", () => {
  it("returns a typed multi-step plan and audit while execution remains local", async () => {
    const h = harness();
    const result = await h.run(principal, input);
    expect(result.plan).toEqual(plan);
    expect(result.audit).toMatchObject({
      executed: false,
      calls: 1,
      model: "muse-spark-1.3",
    });
    expect(h.store.mutate).toHaveBeenCalledTimes(2);
    const r = h.request.mock.calls[0][0] as unknown as {
      input: unknown;
      tools: unknown;
    };
    expect(JSON.stringify(r.input)).not.toContain("screenshot");
    expect(h.settle).toHaveBeenCalledWith(
      "reservation",
      expect.any(Number),
      true,
    );
  });
  it("rejects values and sensitive controls before acquiring budget", async () => {
    const h = harness();
    await expect(
      h.run(principal, {
        ...input,
        controls: [{ id: 0, role: "AXTextField", label: "Password" }],
      }),
    ).rejects.toThrow();
    await expect(
      h.run(principal, {
        ...input,
        controls: [{ ...input.controls[0], value: "private" }],
      }),
    ).rejects.toThrow();
    expect(h.reserve).not.toHaveBeenCalled();
  });
  it("cannot target missing controls, type into buttons, or add control characters in any step", () => {
    for (const step of [
      { ...typeStep, target: 20 },
      { ...typeStep, target: 1 },
      { ...typeStep, text: "18\n" },
      { ...typeStep, kind: "shell" },
      { ...applyStep, text: "x" },
      { ...applyStep, target: 0 },
      { ...applyStep, key: "right" },
    ])
      expect(() =>
        checkedComputerPlan({ ...plan, steps: [typeStep, step] }, input),
      ).toThrow();
    expect(
      computerRequestSchema.safeParse({
        ...input,
        controls: [{ ...input.controls[0], id: 19 }],
      }).success,
    ).toBe(false);
  });
  it("revalidates deletion during settlement before publishing", async () => {
    const h = harness();
    h.settle.mockImplementation(async () => {
      h.revalidate.mockRejectedValue(new ExplorationError("forbidden"));
    });
    await expect(h.run(principal, input)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
  it("preserves reservation on unknown post-send failure", async () => {
    const h = harness();
    h.request.mockRejectedValue(new MetaClientError("network", null, true));
    await expect(h.run(principal, input)).rejects.toThrow();
    expect(h.settle).toHaveBeenCalledWith("reservation", 0, false);
  });
  it("settles known invalid output usage without returning an action", async () => {
    const h = harness();
    h.request.mockResolvedValue({ ...completion(), tools: [] });
    await expect(h.run(principal, input)).rejects.toThrow();
    expect(h.settle).toHaveBeenCalledWith(
      "reservation",
      expect.any(Number),
      true,
    );
  });
  it("cancellation suppresses a late proposal and still bills known usage", async () => {
    const h = harness(),
      controller = new AbortController();
    h.request.mockImplementation(async () => {
      controller.abort();
      return completion();
    });
    await expect(h.run(principal, input, controller.signal)).rejects.toThrow();
    expect(h.settle).toHaveBeenCalledWith(
      "reservation",
      expect.any(Number),
      true,
    );
  });
  it("expired owner cannot send a task", async () => {
    const h = harness();
    h.store.read.mockResolvedValue(null as never);
    await expect(h.run(principal, input)).rejects.toMatchObject({
      code: "session_expired",
    });
    expect(h.request).not.toHaveBeenCalled();
  });
});
it("passes bounded actual action history to Muse and marks done as an assessment only", async () => {
  const h = harness();
  h.request.mockResolvedValue({
    ...completion(),
    tools: [
      {
        ...completion().tools[0],
        parsedArguments: {
          kind: "done",
          reason: "The requested size was confirmed.",
          steps: [],
        },
      },
    ],
  });
  const result = await h.run(principal, {
    ...input,
    history: [
      {
        kind: "type",
        label: "Font size",
        text: "18",
        outcome: "value-confirmed",
      },
    ],
  });
  expect(result.plan.kind).toBe("done");
  expect(result.audit.executed).toBe(false);
  expect(JSON.stringify(h.request.mock.calls[0][0])).toContain(
    "value-confirmed",
  );
});
it("rejects duplicate labels instead of pretending their IDs are meaningful to the user", () => {
  expect(() =>
    checkedComputerPlan(
      { ...plan, steps: [applyStep] },
      {
        ...input,
        controls: [
          ...input.controls,
          { id: 2, role: "AXButton", label: "Apply" },
        ],
      },
    ),
  ).toThrow("Ambiguous");
});

describe("bounded plans", () => {
  const nextSlide = {
    kind: "key" as const,
    target: -1,
    text: "",
    key: "right" as const,
    effect: "Advance Preview to the next slide.",
    consequential: false,
  };
  it("accepts a navigation-key step only from the allowlist and without a control or text", () => {
    expect(
      checkedComputerPlan({ ...plan, steps: [nextSlide] }, input).steps[0],
    ).toEqual(nextSlide);
    for (const step of [
      { ...nextSlide, key: "" },
      { ...nextSlide, key: "return" },
      { ...nextSlide, key: "cmd+q" },
      { ...nextSlide, key: "space" },
      { ...nextSlide, target: 0 },
      { ...nextSlide, text: "x" },
    ])
      expect(() =>
        checkedComputerPlan({ ...plan, steps: [step] }, input),
      ).toThrow();
  });
  it("bounds plan length by five and by the remaining task actions", () => {
    const six = Array.from({ length: 6 }, () => nextSlide);
    expect(() =>
      checkedComputerPlan({ ...plan, steps: six }, input),
    ).toThrow();
    expect(() =>
      checkedComputerPlan(
        { ...plan, steps: [nextSlide, nextSlide] },
        { ...input, maxSteps: 1 },
      ),
    ).toThrow("Plan length");
    expect(() =>
      checkedComputerPlan({ ...plan, steps: [] }, input),
    ).toThrow("Plan length");
    expect(() =>
      checkedComputerPlan(
        { kind: "clarify", reason: "Which slide?", steps: [nextSlide] },
        input,
      ),
    ).toThrow();
  });
  it("marks send/submit/delete presses consequential locally and only as the single final step", () => {
    const send = {
      ...input,
      controls: [
        ...input.controls,
        { id: 2, role: "AXButton" as const, label: "Send message" },
      ],
    };
    const press = { ...applyStep, target: 2, effect: "Send the message." };
    const checked = checkedComputerPlan(
      { ...plan, steps: [typeStep, press] },
      send,
    );
    // The model said false; the local label rule still requires per-step approval.
    expect(checked.steps[1].consequential).toBe(true);
    expect(() =>
      checkedComputerPlan({ ...plan, steps: [press, typeStep] }, send),
    ).toThrow("final");
    expect(() =>
      checkedComputerPlan(
        { ...plan, steps: [{ ...typeStep, consequential: true }, press] },
        send,
      ),
    ).toThrow("final");
  });
  it("refuses coursework hand-in controls outright", () => {
    const lms = {
      ...input,
      controls: [
        ...input.controls,
        { id: 2, role: "AXButton" as const, label: "Turn in" },
        { id: 3, role: "AXButton" as const, label: "Submit assignment" },
      ],
    };
    for (const target of [2, 3])
      expect(() =>
        checkedComputerPlan(
          { ...plan, steps: [{ ...applyStep, target, consequential: true }] },
          lms,
        ),
      ).toThrow("Coursework");
  });
  it("sends maxSteps and the plan tool to Muse within the existing exploration allowance", async () => {
    const h = harness();
    await h.run(principal, { ...input, maxSteps: 3 });
    const r = h.request.mock.calls[0][0] as unknown as {
      input: { content: string }[];
      tools: { name: string }[];
      maxOutputTokens: number;
    };
    expect(JSON.parse(r.input[0].content).maxSteps).toBe(3);
    expect(r.tools.map((t) => t.name)).toEqual(["propose_plan"]);
    expect(h.reserve).toHaveBeenCalledTimes(1);
    expect(h.request).toHaveBeenCalledTimes(1);
  });
});
