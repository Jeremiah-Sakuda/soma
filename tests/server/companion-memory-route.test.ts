import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { closeExplorationStore } from "../../src/lib/server/exploration-store";
const provider = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/lib/server/meta-vision", async (original) => ({
  ...(await original<typeof import("../../src/lib/server/meta-vision")>()),
  requestMetaVisionResponse: provider.request,
}));
vi.mock("../../src/lib/server/account", async (original) => ({
  ...(await original<typeof import("../../src/lib/server/account")>()),
  verifyAccountSession: vi.fn(async () => null),
}));
import {
  GET,
  PATCH,
  POST,
  DELETE,
} from "../../src/app/api/explore/memory/route";
import {
  GET as initialize,
  POST as example,
  PATCH as save,
  DELETE as remove,
} from "../../src/app/api/explore/route";
let directory: string, cookie: string;
function request(
  method: string,
  body?: unknown,
  extra: { cookie?: string; origin?: string; contentType?: string } = {},
) {
  return new Request("http://localhost:3000/api/explore/memory", {
    method,
    headers: {
      origin: extra.origin ?? "http://localhost:3000",
      cookie: extra.cookie ?? cookie,
      "content-type": extra.contentType ?? "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function result(name: string, args: unknown) {
  return {
    status: "completed",
    tools: [
      {
        type: "function_call",
        name,
        arguments: JSON.stringify(args),
        parsedArguments: args,
        call_id: randomUUID(),
      },
    ],
    usage: { input_tokens: 100, output_tokens: 100 },
  };
}
async function savedExample() {
  const { artifact } = await (
    await example(request("POST", { action: "example" }))
  ).json();
  expect(
    (
      await save(
        request("PATCH", {
          action: "save",
          artifactId: artifact.id,
          version: 1,
          state: artifact.state,
        }),
      )
    ).status,
  ).toBe(200);
  return artifact;
}
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "soma-memory-route-"));
  vi.stubEnv("SOMA_PERSISTENCE", "local-synthetic");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("SOMA_EXPLORATION_DB_PATH", join(directory, "explore.sqlite"));
  vi.stubEnv("SOMA_BUDGET_DB_PATH", join(directory, "budget.sqlite"));
  vi.stubEnv("SOMA_LIVE_INFERENCE", "true");
  vi.stubEnv("MODEL_API_KEY", "synthetic-key-no-network");
  vi.stubEnv("META_ALLOCATION_USD", "150");
  vi.stubEnv("META_APP_SPEND_CAP_USD", "5");
  cookie = "";
  provider.request.mockReset();
  provider.request.mockImplementation(async (args) => {
    if (args.tools[0].name === "select_memories")
      return result("select_memories", {
        refs: [],
        reason: "The current example provides the useful evidence.",
      });
    const context = JSON.parse(args.input[0].content);
    return result("propose_memory", {
      concepts: [
        {
          id: "queue",
          label: "Queue",
          summary: "A FIFO frontier orders exploration.",
          uncertainty: ["One supported example."],
          refs: [context.experiences[0].ref],
        },
      ],
      relationships: [],
      nextActivity: {
        question: "Predict another frontier step.",
        reason: "Test the proposed connection.",
        conceptIds: ["queue"],
        refs: [context.experiences[0].ref],
      },
    });
  });
  cookie = (await initialize(request("GET"))).headers
    .get("set-cookie")!
    .split(";")[0];
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("memory HTTP ownership and publication", () => {
  it("reads private memory without creating a fresh anonymous capability", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await GET(request("GET", undefined, { cookie: "" }))).status).toBe(
      401,
    );
  });
  it("stores user goals, detects stale edits and deletes all revisions", async () => {
    const response = await PATCH(
      request("PATCH", {
        action: "upsert-goal",
        revision: 0,
        kind: "goal",
        text: "Learn diagram interpretation",
      }),
    );
    const view = (await response.json()).memory;
    expect(response.status).toBe(200);
    expect(view.goals[0].provenance).toBe("self-report");
    expect(
      (
        await PATCH(
          request("PATCH", {
            action: "delete-goal",
            revision: 0,
            id: view.goals[0].id,
          }),
        )
      ).status,
    ).toBe(409);
    expect((await DELETE(request("DELETE", { revision: 1 }))).status).toBe(200);
    expect((await (await GET(request("GET"))).json()).memory.goals).toEqual([]);
    expect(provider.request).not.toHaveBeenCalled();
  });
  it.each(["PATCH", "POST", "DELETE"])(
    "rejects cross-origin %s before mutation or inference",
    async (method) => {
      const handler =
        method === "PATCH" ? PATCH : method === "POST" ? POST : DELETE;
      expect(
        (
          await handler(
            request(
              method,
              { revision: 0 },
              { origin: "https://attacker.invalid" },
            ),
          )
        ).status,
      ).toBe(403);
      expect(provider.request).not.toHaveBeenCalled();
    },
  );
  it("does not downgrade an invalid account cookie to the valid guest", async () => {
    const response = await GET(
      request("GET", undefined, { cookie: "soma_account=invalid; " + cookie }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("account_required");
  });
  it("isolates goals and saved source references across two guests", async () => {
    await PATCH(
      request("PATCH", {
        action: "upsert-goal",
        revision: 0,
        kind: "goal",
        text: "Private music theory goal",
      }),
    );
    const artifact = await savedExample();
    const other = (
      await initialize(request("GET", undefined, { cookie: "" }))
    ).headers
      .get("set-cookie")!
      .split(";")[0];
    const view = await (
      await GET(request("GET", undefined, { cookie: other }))
    ).json();
    expect(JSON.stringify(view)).not.toContain("Private music");
    expect(
      (
        await POST(
          request(
            "POST",
            {
              artifactId: artifact.id,
              version: 1,
              revision: 0,
              requestId: randomUUID(),
            },
            { cookie: other },
          ),
        )
      ).status,
    ).toBe(404);
    expect(provider.request).not.toHaveBeenCalled();
  });
  it("runs the complete mocked-provider pipeline and removes linked memories with the source", async () => {
    const artifact = await savedExample(),
      input = {
        artifactId: artifact.id,
        version: 1,
        revision: 0,
        requestId: randomUUID(),
      };
    const response = await POST(request("POST", input));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.memory.concepts[0].refs[0]).toMatchObject({
      artifactId: artifact.id,
      version: 1,
    });
    expect(data.audit.calls).toBe(2);
    expect(provider.request).toHaveBeenCalledTimes(2);
    expect((await POST(request("POST", input))).status).toBe(409);
    expect(provider.request).toHaveBeenCalledTimes(2);
    expect(
      (await remove(request("DELETE", { artifactId: artifact.id }))).status,
    ).toBe(200);
    const view = (await (await GET(request("GET"))).json()).memory;
    expect(view.concepts).toEqual([]);
    expect(view.nextActivity).toBeUndefined();
    expect(view.revision).toBe(2);
  });
  it("rejects oversized, malformed and extra-field requests with sanitized errors", async () => {
    expect(
      (
        await PATCH(
          request("PATCH", {
            action: "upsert-goal",
            revision: 0,
            kind: "goal",
            text: "x".repeat(13000),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await PATCH(
          request("PATCH", {
            action: "upsert-goal",
            revision: 0,
            kind: "goal",
            text: "Goal",
            mastery: 1,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await DELETE(
          request("DELETE", { revision: 0 }, { contentType: "text/plain" }),
        )
      ).status,
    ).toBe(400);
    expect(provider.request).not.toHaveBeenCalled();
  });
});
