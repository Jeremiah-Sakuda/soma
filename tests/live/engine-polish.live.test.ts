import { it, expect } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { validateEngine } from '../../docs/examples/pm121/lib/engine';
import { presentationSchema, validatePresentation } from '../../docs/examples/pm123/presentation';
import {
  requestMetaVisionResponse,
  visionRequestUpperBoundUsd,
} from '../../src/lib/server/meta-vision';
import { requestMetaResponse, MetaClientError } from '../../src/lib/server/meta-client';
import { reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
it.skipIf(process.env.SOMA_ENGINE_POLISH_LIVE !== 'true')(
  'authors and reviews an actual refined engine presentation within retained admission and budget limits',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
    const folder = process.env.SOMA_ENGINE_POLISH_OUTPUT || `.local/pm123/live-${Date.now()}`;
    mkdirSync(folder, { recursive: true });
    const id = randomBytes(32).toString('hex'),
      principal: ExplorationPrincipal = {
        kind: 'guest',
        id,
        workspaceId: id,
        generation: id,
        key: `guest-${id}`,
      },
      lease = randomUUID();
    const ledger = async () =>
      Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0);
    const receipt: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
      before: await ledger(),
      cap: Number(process.env.META_APP_SPEND_CAP_USD),
      mode: 'actual Muse generation on an original synthetic source',
      attempts: [],
    };
    let reservation: string | undefined,
      acquired = false,
      certain = true,
      cost = 0,
      calls = 0;
    const started = Date.now(),
      deadline = started + 90000,
      attempts = receipt.attempts as unknown[];
    const save = () =>
      writeFileSync(
        `${folder}/generation-receipt.json`,
        JSON.stringify({ ...receipt, calls, costUsd: cost, certain }, null, 2),
      );
    const source = readFileSync('docs/examples/pm121/public/source.png');
    const base = validateEngine(JSON.parse(readFileSync('docs/examples/pm121/film.json', 'utf8')));
    const instructions = `You are Soma's editorial illustrator and educational product designer. Refine this ACTUAL recorded engine film for a polished startup demonstration. Return presentation data only, not code. Source facts are the original synthetic teaching card. This remains idealized explanatory mechanics: no pressure, force, efficiency, or temperature numbers. Keep the four-stroke order and accurate closed/open valve behavior. A cycle has four strokes/two crank turns. No mastery, pressure simulation or live inference during replay claims.
Write a confident restrained title <=55chars and subtitle <=110chars. No hype. Four concise stroke verbs (professional verbs, not suck/fire/cutesy metaphors), captions<=100chars, and narration12-15words maximum fitting6seconds at170wpm. Teach cause/effect, and mention two turns in the final narration. Avoid absolute complete exhaust removal or measurable output claims. Parts exactly piston,rod,crank. Each needs recognizable name, concise explanation of its role<=155chars and a useful observation cue<=85chars for direct crank manipulation. All copy grounded in current mechanism; no fabricated controls.
You MAY refine0..6 existing engine paths ONLY from allowed IDs: piston-skirt,rod-beam,crank-counterweight,housing-rounded-base,head-fin-upper-left,head-fin-upper-right. Refine geometry for machined, sophisticated contours, not rectangles. Core anchors are inviolate: pistonpin local(0,0), crown y-36, skirt width<=104 and ends<=26; rod localorigincrankpin, top(0,-170), metal MUST remain continuous and contain both0,0 and0,-170; width<=15, totalextent y-186..16. Crankcounterweight MUST contain0,0 and0,10, continuous neck to rounded mass up to y74 with maxradius82. Housingbase stays x284..516 y520..558 leaving crankcase open. Finpaths remain fixed x282..306 and494..518 y96..108. Do not remove or duplicate valve parts. Rendered material shading, machined highlights and cut-face hatching are APPLICATION finishes on your paths, not new model geometry. Return refined paths only when they improve craft. Palette warm metallicpiston/coolsteelrod, thin1..1.2 outlines. All paths remaininsideoriginalbounds, no executableHTML, URLs or labels.
`;
    const copyBase = process.env.SOMA_POLISH_COPY_BASE
      ? validatePresentation(
          JSON.parse(readFileSync(process.env.SOMA_POLISH_COPY_BASE, 'utf8')),
          base,
        )
      : null;
    const copySchema = z.strictObject({
      subtitle: z.string().min(1).max(110),
      strokes: z
        .array(
          z.strictObject({
            name: z.enum(['Intake', 'Compression', 'Power', 'Exhaust']),
            verb: z.string().min(1).max(26),
            caption: z.string().min(1).max(100),
          }),
        )
        .length(4),
    });
    const schema = z.toJSONSchema(copyBase ? copySchema : presentationSchema);
    delete schema.$schema;
    const chargeError = (e: unknown, model: 'muse-spark-1.3' | 'muse-wonder-1.0') => {
      if (e instanceof MetaClientError) {
        if (e.usage) cost += usageCost(e.usage.input_tokens, e.usage.output_tokens, model);
        else if (e.requestSent) certain = false;
      }
    };
    let issues = process.env.SOMA_ENGINE_PRESENTATION_REPAIR
      ? 'Refine this exact presentation, preserving ALL art refinements and part descriptions. ONLY repair copy: intake narration must say the chamber volume grows rather than a growing cylinder; power narration must avoid strongly, and state expanding gas pushes piston down with both valves closed. Subtitle should be a concise appealing learner-facing line about four strokes/two turns, at most12words, no hype or unmeasured benefit. Preserve professional stroke labels, source facts and all other data. Candidate:' +
        readFileSync(process.env.SOMA_ENGINE_PRESENTATION_REPAIR, 'utf8')
      : '';
    if (copyBase)
      issues =
        'Editorial COPY ONLY. Return subtitle and4stroke name/verb/caption entries. Preserve order. No narration, parts or refinements in the response. Make captions natural complete learner-facing sentences, not semicolon fragments or abbreviations such as both closed. Correctly name the valves when relevant. Power should explain spark ignition then expanding gas driving piston down. Each verb is a concise natural label, not the awkward Expand driving piston. Subtitle should be inviting and concise about seeing four strokes/two turns, no hype. Do not change facts or claim measured outcomes. Narration remains unchanged in app. Current presentation:' +
        JSON.stringify(copyBase);
    try {
      await explorationStore.mutate(principal, () => {}, { create: true, acquire: lease });
      acquired = true;
      reservation = await reserveInference(principal.key, 'exploration');
      for (let attempt = 1; attempt <= 2; attempt++) {
        const request = {
          instructions,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text:
                    'Current film:' +
                    JSON.stringify(base) +
                    ' Create the refined presentation. ' +
                    issues,
                },
                {
                  type: 'input_image',
                  image_url: `data:image/png;base64,${source.toString('base64')}`,
                },
              ],
            },
          ],
          tools: [],
          deadlineMs: Math.min(30000, deadline - Date.now()),
          maxOutputTokens: 4096,
          reasoningEffort: 'minimal' as const,
          structuredOutput: { name: 'soma_engine_presentation', schema },
        };
        writeFileSync(
          `${folder}/request-${attempt}.json`,
          JSON.stringify(
            {
              instructions,
              inputText: 'Create the complete film. ' + issues,
              sourceSha256: createHash('sha256').update(source).digest('hex'),
            },
            null,
            2,
          ),
        );
        if (
          calls >= 4 ||
          request.deadlineMs <= 0 ||
          cost + visionRequestUpperBoundUsd(request) > 0.35
        )
          throw Error('Bounded generation allowance exhausted.');
        const start = Date.now();
        let result;
        if (attempt === 1 && process.env.SOMA_FILM_CANDIDATE_FILE) {
          result = {
            structured: JSON.parse(readFileSync(process.env.SOMA_FILM_CANDIDATE_FILE, 'utf8')),
          };
          attempts.push({
            stage: 'reuse-candidate',
            path: process.env.SOMA_FILM_CANDIDATE_FILE,
            newCalls: 0,
          });
        } else {
          try {
            calls++;
            result = await requestMetaVisionResponse(request);
            cost += usageCost(result.usage.input_tokens, result.usage.output_tokens);
          } catch (e) {
            chargeError(e, 'muse-spark-1.3');
            throw e;
          }
          writeFileSync(`${folder}/author-${attempt}.json`, JSON.stringify(result, null, 2));
          attempts.push({
            stage: 'author',
            attempt,
            durationMs: Date.now() - start,
            usage: result.usage,
          });
          save();
        }
        if (copyBase) {
          const patch = copySchema.parse(result.structured);
          if (patch.strokes.map((s) => s.name).join(',') !== 'Intake,Compression,Power,Exhaust')
            throw Error('Invalid copy patch order');
          result.structured = {
            ...copyBase,
            subtitle: patch.subtitle,
            strokes: copyBase.strokes.map((s, i) => ({ ...s, ...patch.strokes[i] })),
          };
        }
        let film;
        try {
          film = validatePresentation(result.structured, base);
        } catch (e) {
          issues = `Validation failed: ${(e as Error).message}. Repair this exact candidate: ${JSON.stringify(result.structured)}`;
          if (attempt === 2) throw e;
          continue;
        }
        const reviewText =
          'Review source fit and accuracy of this refined presentation. Deterministic kinematics and valve timing are unchanged from the supplied source. Only the six allowed path refinements may change silhouette; verify continuity/anchors/bounds, no unsupported measurements. Rod upperend0,-170 andlower0,0; pistonwidth<=104skirtend26;crownunchanged;crankcountercontains0,0 and0,10. Voice<=15words/6sec; original synthetic source; no live/learning/pressure claims. Strokes and part explanation must be correct and clear. Caption0atintake means a description of the whole intake stroke, not that valve is open exactly at boundary. No numerical thermodynamics. Be concise; at most3 substantive issues. Base:' +
          JSON.stringify(base) +
          ' New presentation:' +
          JSON.stringify(film);
        const bound = (Buffer.byteLength(reviewText) * 4 + 2048 * 20) / 1e6;
        if (calls >= 4 || Date.now() >= deadline || cost + bound > 0.35)
          throw Error('Review headroom exhausted.');
        const reviewStart = Date.now();
        let review;
        try {
          calls++;
          review = await requestMetaResponse({
            instructions: 'You are the advisory reviewer for Soma. No source inventions.',
            input: [{ role: 'user', content: reviewText }],
            tools: [],
            model: 'muse-wonder-1.0',
            deadlineMs: Math.min(30000, deadline - Date.now()),
            maxOutputTokens: 2048,
            reasoningEffort: 'minimal',
            structuredOutput: {
              name: 'film_review',
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['approved', 'issues'],
                properties: {
                  approved: { type: 'boolean' },
                  issues: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          });
          cost += usageCost(
            review.usage.input_tokens,
            review.usage.output_tokens,
            'muse-wonder-1.0',
          );
        } catch (e) {
          chargeError(e, 'muse-wonder-1.0');
          throw e;
        }
        writeFileSync(`${folder}/review-${attempt}.json`, JSON.stringify(review, null, 2));
        if (review.status !== 'completed')
          throw Error('Reviewer output incomplete; retained usage, no accepted film.');
        const verdict = z
          .object({ approved: z.boolean(), issues: z.array(z.string()) })
          .parse(review.structured);
        attempts.push({
          stage: 'review',
          attempt,
          durationMs: Date.now() - reviewStart,
          usage: review.usage,
          verdict,
        });
        save();
        if (!verdict.approved) {
          issues =
            'Reviewer found: ' +
            verdict.issues.join(' ') +
            ' Repair this exact film, preserving ALL geometry, IDs and artwork except the specific fixes. Return a complete corrected film: ' +
            JSON.stringify(film);
          if (attempt === 2) throw Error(issues);
          continue;
        }
        writeFileSync(`${folder}/presentation.json`, JSON.stringify(film, null, 2));
        receipt.status = 'authored-validated-reviewed';
        receipt.sourceSha256 = createHash('sha256').update(source).digest('hex');
        receipt.instructions = instructions;
        break;
      }
      expect(receipt.status).toBe('authored-validated-reviewed');
    } catch (e) {
      receipt.status = 'failed';
      receipt.code = (e as Error).message;
      throw e;
    } finally {
      if (reservation) await settleInference(reservation, cost, certain);
      if (acquired) await explorationStore.mutate(principal, () => {}, { release: lease });
      receipt.elapsedMs = Date.now() - started;
      receipt.finishedAt = new Date().toISOString();
      receipt.after = await ledger();
      save();
    }
  },
  150000,
);
