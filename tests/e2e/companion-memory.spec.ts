import { test, expect, type Page } from "@playwright/test";
import type { CompanionMemoryView } from "../../src/lib/domain/companion-memory";

// Original synthetic profile and scene references. Scripted analysis checks UI
// behavior only; the first journey exercises real local owned persistence.
async function openMemory(page: Page) {
  // Memory lives in the More menu of the journal's top bar.
  await page.getByLabel("More", { exact: true }).click();
  await page
    .getByRole("button", { name: "Your goals & understanding" })
    .click();
  await expect(
    page.getByLabel("What would you like Soma to remember?"),
  ).toBeVisible();
}

test("goals and preferences persist in the real owned session and clear without removing explorations", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(
    page
      .getByRole("button", { name: "Try the original example", exact: true })
      .first(),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Try the original example", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Save exploration", exact: true })
    .click();
  await openMemory(page);
  const section = page.getByRole("region", {
    name: "Your goals and understanding",
  });
  await section
    .getByLabel("What would you like Soma to remember?")
    .fill("Understand how sound and vibration relate.");
  await section
    .getByRole("button", { name: "Remember this", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    section.getByText("Understand how sound and vibration relate.", {
      exact: true,
    }),
  ).toBeVisible();
  await section.getByRole("button", { name: "Edit goal", exact: true }).click();
  await section
    .getByLabel("Edit your context")
    .fill("Understand musical instruments through experiments.");
  await section
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    section.getByText("Understand musical instruments through experiments.", {
      exact: true,
    }),
  ).toBeVisible();
  await section.getByLabel("Remember as").selectOption("preference");
  await section
    .getByLabel("What would you like Soma to remember?")
    .fill("Let me make a prediction before explaining.");
  await section
    .getByRole("button", { name: "Remember this", exact: true })
    .click();
  await expect(
    section.getByText("Your preference", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await openMemory(page);
  await expect(
    section.getByText("Understand musical instruments through experiments.", {
      exact: true,
    }),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Clear memory…", exact: true })
    .click();
  await section
    .getByRole("button", { name: "Keep memory", exact: true })
    .click();
  await expect(
    section.getByText("Your preference", { exact: true }),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Clear memory…", exact: true })
    .click();
  await section
    .getByRole("button", { name: "Confirm clear memory", exact: true })
    .click();
  await expect(
    section.getByText("Your preference", { exact: true }),
  ).toHaveCount(0);
  const session = await page.request.get("/api/explore");
  expect((await session.json()).artifacts.length).toBeGreaterThan(0);
});

test("failed saves and revision conflicts preserve drafts for explicit retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/explore/memory", async (route) => {
    if (route.request().method() === "PATCH" && fail) {
      fail = false;
      return route.fulfill({ status: 409, json: { code: "version_conflict" } });
    }
    return route.continue();
  });
  await page.goto("/explore");
  await expect(
    page
      .getByRole("button", { name: "Try the original example", exact: true })
      .first(),
  ).toBeEnabled();
  await openMemory(page);
  const field = page.getByLabel("What would you like Soma to remember?");
  await field.fill("I want to understand financial spreadsheets.");
  await page
    .getByRole("button", { name: "Remember this", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "memory changed elsewhere" }),
  ).toBeVisible();
  await expect(field).toHaveValue(
    "I want to understand financial spreadsheets.",
  );
  await page
    .getByRole("button", { name: "Refresh memory", exact: true })
    .click();
  await expect(field).toHaveValue(
    "I want to understand financial spreadsheets.",
  );
  await page
    .getByRole("button", { name: "Remember this", exact: true })
    .click();
  await expect(
    page.getByText("I want to understand financial spreadsheets.", {
      exact: true,
    }),
  ).toBeVisible();
});

for (const width of [375, 620])
  test(`proposed map has evidence and editable recommendations at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 704 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let memory: CompanionMemoryView = {
      revision: 0,
      goals: [],
      concepts: [],
      relationships: [],
      evidence: [],
    };
    const posts: unknown[] = [];
    let artifactId = "";
    const ref = () => ({
      artifactId,
      version: 1,
      observationId: "original-example",
      sourceVersion: 1,
    });
    await page.route("**/api/explore/memory", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        posts.push(body);
        artifactId = body.artifactId;
        memory = {
          revision: 1,
          goals: [],
          concepts: [
            {
              id: "frontier",
              label: "Keeping a frontier",
              summary: "A list of possibilities still to investigate.",
              uncertainty: ["This connection needs another example."],
              refs: [ref()],
              revision: 1,
              createdAt: "2026-10-30T10:00:00Z",
              provenance: "model-proposal",
            },
            {
              id: "process",
              label: "Exploring a process",
              summary:
                "Follow one change while holding other conditions fixed.",
              uncertainty: [],
              refs: [ref()],
              revision: 1,
              createdAt: "2026-10-30T10:00:00Z",
              provenance: "model-proposal",
            },
          ],
          relationships: [
            {
              id: "cross-context",
              from: "frontier",
              to: "process",
              kind: "transfer",
              reason: "Both involve tracking which possibilities remain.",
              refs: [ref()],
              revision: 1,
              createdAt: "2026-10-30T10:00:00Z",
              provenance: "model-proposal",
            },
          ],
          evidence: [
            {
              id: "answer-one",
              kind: "prediction",
              ref: ref(),
              recordedAt: "2026-10-30T10:00:00Z",
              answer: "A",
              reason: "It entered first.",
              matches: true,
              exposure: "diagram-visible-practice",
              assistance: "diagram-visible",
              revealedBeforeAnswer: false,
            },
          ],
          nextActivity: {
            createdAt: "2026-10-30T10:00:00Z",
            provenance: "model-proposal",
            question:
              "How might a waiting list help explain a different process?",
            reason: "Try transferring the idea to a new context.",
            conceptIds: ["frontier"],
            refs: [ref()],
          },
        };
        return route.fulfill({
          json: {
            memory,
            audit: { calls: 1, model: "synthetic-script", costUsd: 0 },
          },
        });
      }
      return route.fulfill({
        json: { memory, kind: "guest", liveEnabled: true },
      });
    });
    await page.goto("/explore");
    await expect(
      page
        .getByRole("button", { name: "Try the original example", exact: true })
        .first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Try the original example", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Save exploration", exact: true })
      .click();
    await openMemory(page);
    await expect(
      page.getByRole("button", {
        name: "Connect this exploration with Muse",
        exact: true,
      }),
    ).toBeEnabled();
    expect(posts).toHaveLength(0);
    await page
      .getByRole("button", {
        name: "Connect this exploration with Muse",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", { name: "Concept relationship map" }),
    ).toBeVisible();
    await page
      .getByRole("region", { name: "Your goals and understanding" })
      .screenshot({ path: testInfo.outputPath(`memory-${width}.png`) });
    expect(posts).toHaveLength(1);
    await page
      .getByRole("button", { name: "Correct Keeping a frontier", exact: true })
      .click();
    await expect(
      page.getByLabel("Concept name", { exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Cancel correction", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear memory…", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirm clear memory", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Keep memory", exact: true })
      .click();
    await page
      .getByText("Recorded practice (1)", { exact: true })
      .first()
      .click();
    await expect(
      page
        .getByText("This is practice evidence, not a mastery judgment.")
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText("Your answer: A · Your explanation: It entered first.")
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Use this question", exact: true })
      .click();
    await expect(
      page.getByLabel("Where would you like to go next?"),
    ).toHaveValue("How might a waiting list help explain a different process?");
    expect(posts).toHaveLength(1);
    await page
      .getByRole("button", {
        name: "Open supporting exploration · v1",
        exact: true,
      })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Why does A come before B?",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
