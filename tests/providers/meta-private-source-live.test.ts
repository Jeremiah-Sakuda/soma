import { describe, it } from 'vitest';
import { chmod, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applySourceImport, sourceImportSchema } from '../../src/lib/server/imports';
import { prepareWithSpark } from '../../src/lib/server/meta';
import { MAX_CALLS } from '../../src/lib/server/budget';

const privateSelectionSchema = z.strictObject({
  course: z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    code: z.string().min(1).max(40),
    title: z.string().min(1).max(160),
  }),
  title: z.string().min(1).max(160),
  body: z.string().min(20).max(48_000),
  topic: z.string().min(10).max(300),
});
function check(condition: unknown, stage: string): asserts condition {
  if (!condition) throw new Error(`Private-source validation failed at ${stage}.`);
}

/** Explicit opt-in; private inputs/results remain in ignored .local, never in snapshots or console output. */
describe.skipIf(process.env.SOMA_PRIVATE_SOURCE_TEST !== 'true')(
  'private selected course material: bounded live preparation',
  () => {
    it(
      'prepares a grounded ordinary-practice preview and reuses it without another provider call',
      { timeout: 110_000, retry: 0 },
      async () => {
        let stage = 'private input validation';
        const originalFetch = globalThis.fetch;
        let metaCalls = 0;
        const startedAt = new Date().toISOString();
        try {
          const directory = await realpath(resolve('.local'));
          const configuredPath = process.env.SOMA_PRIVATE_SOURCE_PATH;
          check(configuredPath, stage);
          const inputPath = await realpath(resolve(configuredPath));
          const inputRelative = relative(directory, inputPath);
          check(
            inputRelative && !inputRelative.startsWith('..') && !isAbsolute(inputRelative),
            stage,
          );
          const metadata = await lstat(inputPath);
          check(
            metadata.isFile() &&
              metadata.size <= 64_000 &&
              (metadata.mode & 0o777) === 0o600 &&
              metadata.uid === process.getuid?.(),
            stage,
          );
          const selected = privateSelectionSchema.safeParse(
            JSON.parse(await readFile(inputPath, 'utf8')),
          );
          check(selected.success, stage);
          const selection = selected.data;
          stage = 'budget preflight';
          const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1');
          check(
            Number.isFinite(cap) &&
              cap > 0 &&
              cap <= 1 &&
              process.env.SOMA_LIVE_INFERENCE === 'true' &&
              Boolean(process.env.MODEL_API_KEY),
            stage,
          );
          const empty = seedEmptyAccountWorkspace(`private-preview-${randomUUID()}`);
          const imported = applySourceImport(
            empty,
            sourceImportSchema.parse({
              kind: 'email-text',
              importId: 'private-selection-v1',
              expectedRevision: 0,
              sourceKey: 'private-manually-selected-course-note',
              course: selection.course,
              title: selection.title,
              text: selection.body,
            }),
          );
          const state = imported.workspace,
            original = JSON.stringify(state);
          const sourceRefs = imported.sourceIds.map((sourceId) => ({
            sourceId,
            version: state.sources.find((source) => source.id === sourceId)!.version,
          }));
          check(
            state.mode === 'account' && state.lessons.length === 0 && state.attempts.length === 0,
            'empty private preview workspace',
          );
          globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input instanceof Request ? input.url : String(input);
            if (url === 'https://api.meta.ai/v1/responses') {
              metaCalls++;
              check(metaCalls <= MAX_CALLS, 'provider call bound');
            }
            return originalFetch(input, init);
          }) as typeof fetch;
          stage = 'live preparation';
          // Exactly one generation attempt. The engine permits at most one repair inside its four-call budget.
          const result = await prepareWithSpark(state, selection.course.id, selection.topic, {
            sourceRefs,
            trigger: 'source-change',
          });
          stage = 'practice and provenance';
          const { lesson, run } = result;
          check(
            lesson.kind === 'practice' &&
              lesson.mode === 'live' &&
              !lesson.examEligible &&
              lesson.validation?.status === 'development-preview',
            stage,
          );
          check(
            run.status === 'completed' &&
              run.mode === 'live' &&
              run.trigger === 'Collected course source change',
            stage,
          );
          check(
            lesson.sourceIds.length > 0 &&
              lesson.sourceIds.every((id) => imported.sourceIds.includes(id)),
            stage,
          );
          check(
            lesson.supportingPassages?.length &&
              lesson.sourceIds.every((id) =>
                lesson.supportingPassages!.some((passage) => passage.sourceId === id),
              ),
            stage,
          );
          for (const passage of lesson.supportingPassages!) {
            const source = state.sources.find(
              (item) => item.id === passage.sourceId && item.status === 'current',
            );
            check(
              source &&
                source.courseId === selection.course.id &&
                source.version === passage.version &&
                source.version === lesson.sourceVersions[source.id] &&
                source.body.slice(0, 4000).includes(passage.quote),
              'exact current disclosed citation',
            );
          }
          check(JSON.stringify(state) === original, 'immutable original records');
          check(metaCalls > 0 && metaCalls <= MAX_CALLS, 'bounded generation');
          stage = 'unchanged reuse';
          const persistedPreview = { ...state, lessons: [lesson] },
            beforeReuse = JSON.stringify(persistedPreview),
            beforeCalls = metaCalls;
          const reused = await prepareWithSpark(
            persistedPreview,
            selection.course.id,
            selection.topic,
            { sourceRefs, trigger: 'source-change' },
          );
          check(
            reused.lesson.id === lesson.id &&
              reused.run.status === 'unchanged' &&
              reused.run.mode === 'prepared' &&
              metaCalls === beforeCalls &&
              JSON.stringify(persistedPreview) === beforeReuse,
            stage,
          );
          stage = 'private preview save';
          await mkdir(directory, { recursive: true, mode: 0o700 });
          const output = resolve(directory, 'private-course-preview.json');
          // Explicitly replace a previous local preview with owner-only permissions before writing any private content.
          await writeFile(output, '', { mode: 0o600 });
          await chmod(output, 0o600);
          await writeFile(
            output,
            JSON.stringify(
              {
                provenance:
                  'Manually selected through Codex Gmail and imported for an ephemeral preview. This is not a live Soma OAuth collection.',
                reviewStatus:
                  'User review pending. Answer correctness and instructional fit have not been independently reviewed.',
                persistedToUserWorkspace: false,
                startedAt,
                finishedAt: new Date().toISOString(),
                metaCalls,
                lesson,
                run,
                reuseRun: reused.run,
              },
              null,
              2,
            ),
            { mode: 0o600 },
          );
        } catch {
          // Never print provider messages, private source text, names, course identifiers, or generated content on failure.
          throw new Error(
            `Private-source live check stopped at ${stage}; no automatic retry was performed.`,
          );
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    );
  },
);
