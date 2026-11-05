import { it, expect } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { engineSchema, validateEngine, enginePose } from '../../docs/examples/pm121/lib/engine';
import {
  requestMetaVisionResponse,
  visionRequestUpperBoundUsd,
} from '../../src/lib/server/meta-vision';
import { requestMetaResponse, MetaClientError } from '../../src/lib/server/meta-client';
import { reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
it.skipIf(process.env.SOMA_ENGINE_FILM_LIVE !== 'true')(
  'authors and reviews a real same-source film within retained admission and budget limits',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
    const folder = process.env.SOMA_ENGINE_FILM_OUTPUT || `.local/pm121/live-${Date.now()}`;
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
    const instructions = `You are Soma's vector illustrator and educational film director. Return engine-film-v1 data, never code. Create a polished recognizable four-stroke single-cylinder cutaway. You author ALL visible engine vector paths, palette, four captions and voice script. The app owns deterministic slider-crank kinematics, gas visualization, spark, fixed part callouts, controls and timing. Use the original synthetic teaching source. This is idealized qualitative mechanics, not quantitative thermodynamics.
Canvas800x600. Fixed engine centerline x400; crankshaft center(400,450), crankradius64; rodlength170. At topdeadcenter pistonpin(400,216), at bottomdeadcenter(400,344). Piston crown is36px ABOVE pin, so crown y180..308. Cylinder bore x332..468, cylinder roof y144. Important: preserve these attachment/clearance assumptions. Use28-36 short paths, detailed and crafted, avoid cartoon or bulky outlines. Warm paper, subtle sage/silver engine casting, dark fine edges, copper piston, blue intake and warm exhaust. Color only hex6 or none. Main metal light enough to distinguish dark rod/crank. Draw a handsome crankcase/cylinder silhouette, cast ribs, bolts, cylinder head, visible passage openings, machined piston rings and skirt, shaped connecting rod, crank counterweight and realistic poppet valves. The app adds concentric pin bearings at both rod ends and crankshaft center. Paths only, no text: app renders clean labels.
Artwork is grouped by role, paths for same role share transform. Fixed roles housing/head/ports/detail are absolute canvas coords. Housing must be a ring/open cutaway: leave bore x332..468 y144..380 AND crankcase interior open; use separate sides, not a filled silhouette covering motion. Crankcase outer bounds x284..516 y355..550; can have filled pale background but not hide crank. Head spans x306..494 y88..144, with spark-plug hole nearx400 and two valve holes nearx360/440; ports leftx250..360 rightx440..550 y110..140, visibly communicating with chamber at roof144. Housing wall x306..330 and470..494; NO horizontal bottom wall crossing bore. Optional fins extend tox286/514. No fixed detail path inside moving bore or crankcase interior. All geometry withinx240..560 andy70..558.
Moving role piston uses LOCAL coordinates withorigin at pistonpin: crown fromx-64..64 y-36, skirt ends aty26; rings at y-28 and-21; centerpin islocal(0,0). Moving rod uses LOCAL origin at crankpin, upper end(0,-170), with both pinholes visible, maxwidth±15; draw elegant tapered I-beam. Moving crank uses LOCAL origin at crankshaft center, crankpin(0,-64), rotation clockwise, maxradius82; drawcounterweight opposite pin, not a filleddisk obscuringrod. Intake-valve and exhaust-valve are LOCAL to (360,136) and(440,136), translate DOWN0..9; stem y-43..0, poppethead x-15..15 aty0..5, head seats at chamber roof144. Never connect piston rigidly to housing. No extra motion tracks, no invented forces/pressure values.
Exactly4 strokes in order Intake,Compression,Power,Exhaust. Each is6seconds, total24sec. verb <=22characters, caption <=110chars, narration 12-15words maximum and accurate; script should fit~5sec at170wpm. Clear cause and effect. Explain two crank turns per cycle in summary or last line. Assumptions explicitly illustrative dimensions, idealized valves without overlap/advance, no thermodynamic simulation. Use your own distinctive crafted vector detailing, not only rectangles. Do not add labels to art paths.`;
    const schema = z.toJSONSchema(engineSchema);
    delete schema.$schema;
    const chargeError = (e: unknown, model: 'muse-spark-1.3' | 'muse-wonder-1.0') => {
      if (e instanceof MetaClientError) {
        if (e.usage) cost += usageCost(e.usage.input_tokens, e.usage.output_tokens, model);
        else if (e.requestSent) certain = false;
      }
    };
    let issues = process.env.SOMA_ENGINE_REPAIR_FILE
      ? (process.env.SOMA_ENGINE_FIX ||
          'Repair concrete geometry errors while preserving artwork.') +
        ' Candidate:' +
        readFileSync(process.env.SOMA_ENGINE_REPAIR_FILE, 'utf8')
      : '';
    try {
      await explorationStore.mutate(principal, () => {}, { create: true, acquire: lease });
      acquired = true;
      reservation = await reserveInference(principal.key, 'exploration');
      for (let attempt = 1; attempt <= 2; attempt++) {
        const patchBase = process.env.SOMA_ENGINE_PATCH_FILE
          ? validateEngine(JSON.parse(readFileSync(process.env.SOMA_ENGINE_PATCH_FILE, 'utf8')))
          : null;
        const patchSchema = {
          type: 'object',
          additionalProperties: false,
          required: ['updates'],
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'd'],
                properties: { id: { type: 'string' }, d: { type: 'string' } },
              },
            },
          },
        };
        const request = {
          instructions: patchBase
            ? 'Return ONLY the requested bounded vector path repairs, no other edits. Data only. Preserve all other properties in the supplied candidate. ' +
              instructions
            : instructions,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'Create the complete film. ' + issues },
                {
                  type: 'input_image',
                  image_url: `data:image/png;base64,${source.toString('base64')}`,
                },
              ],
            },
          ],
          tools: [],
          deadlineMs: Math.min(30000, deadline - Date.now()),
          maxOutputTokens: 6144,
          reasoningEffort: 'minimal' as const,
          structuredOutput: { name: 'soma_engine_film', schema: patchBase ? patchSchema : schema },
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
        if (patchBase) {
          const patchCount = process.env.SOMA_ENGINE_COUNTERWEIGHT_FIX === 'true' ? 1 : 3;
          const patch = z
            .strictObject({
              updates: z
                .array(z.strictObject({ id: z.string(), d: z.string() }))
                .length(patchCount),
            })
            .parse(result.structured);
          const allowed = new Set(
            process.env.SOMA_ENGINE_COUNTERWEIGHT_FIX === 'true'
              ? ['crank-counterweight']
              : ['exhaust-valve-stem', 'head-deck', 'crank-web'],
          );
          if (
            new Set(patch.updates.map((a) => a.id)).size !== patchCount ||
            patch.updates.some((a) => !allowed.has(a.id))
          )
            throw Error('Invalid patch scope');
          result.structured = {
            ...patchBase,
            art: patchBase.art.map((a) => ({
              ...a,
              d: patch.updates.find((p) => p.id === a.id)?.d ?? a.d,
            })),
          };
        }
        let film;
        try {
          film = validateEngine(result.structured);
        } catch (e) {
          issues = `Previous output failed validation: ${(e as Error).message}. Repair this candidate: ${JSON.stringify(result.structured)}`;
          if (attempt === 2) throw e;
          continue;
        }
        const reviewText =
          'Review this idealized engine data and source facts. App renderer ALWAYS adds spark plug, transient spark flash only at360..377, phase-gated moving gas particles, phase-gated intake/exhaust dotted flow arrows. These are NOT authored art paths and must NOT be duplicated. Spark is0 at exactly360 and peaks368.5; it is a short event, not absent. Static blue color in an intake passage denotes its contents, not necessarily flow; reject an always-visible flow arrow instead. Do not reject colloquial qualitative pushes as unmeasured force without a numerical claim.  App owns deterministic exact crank/rod attachments, pistonpin y216..344, crown y180..308 inside borex332..468,roof144. Four strokes at0..180 intake open/down;180..360 bothclosed/up;360..540 sparkthenpower bothclosed/down;540..720 exhaustopen/up. Valves close at phase boundaries, no overlap or advance. Film24seconds,6perstroke. Art paths are app-controlled role transforms: pistonlocaloriginpin; rodlocalorigincrankpin upperend0,-170; crankorigin400,450pin0,-64; valveslocalorigins360/440,136 downwardlift0..9. Fixed housing/ports/head absolute. No model transforms. Inspect accurate captions and narration, plausible clearances/path placement, recognizability and substantive scientific issues. No quantitative pressure/force claims allowed. Advisory not a measured physics certification. Return at most3 concise concrete issues. Evaluated poses:' +
          JSON.stringify([0, 90, 180, 270, 360, 368.5, 450, 540, 630, 720].map(enginePose)) +
          ' Candidate:' +
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
        writeFileSync(`${folder}/film.json`, JSON.stringify(film, null, 2));
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
