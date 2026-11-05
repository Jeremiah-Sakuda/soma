import { it, expect } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import {
  investigationSchema,
  validateInvestigations,
  preparedQuestions,
  identity,
  sourceQuotes,
} from '../../docs/examples/pm126/investigation';
import { enginePose } from '../../docs/examples/pm121/lib/engine';
import {
  requestMetaVisionResponse,
  visionRequestUpperBoundUsd,
} from '../../src/lib/server/meta-vision';
import { requestMetaResponse, MetaClientError } from '../../src/lib/server/meta-client';
import { reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
it.skipIf(process.env.SOMA_ENGINE_INVESTIGATION_LIVE !== 'true')(
  'records actual Muse-selected investigations with bounded admission and independent state checks',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
    const folder = process.env.SOMA_ENGINE_INVESTIGATION_OUTPUT || '.local/pm126/live';
    mkdirSync(folder, { recursive: true });
    const id = randomBytes(32).toString('hex'),
      lease = randomUUID(),
      principal: ExplorationPrincipal = {
        kind: 'guest',
        id,
        workspaceId: id,
        generation: id,
        key: 'guest-' + id,
      };
    const ledger = async () =>
        Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0),
      started = Date.now(),
      deadline = started + 90000;
    const receipt: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
      before: await ledger(),
      cap: Number(process.env.META_APP_SPEND_CAP_USD),
      mode: 'actual recorded Muse investigation on original synthetic source',
      ...identity,
      attempts: [],
    };
    const attempts = receipt.attempts as unknown[];
    let reservation: string | undefined,
      acquired = false,
      cost = 0,
      calls = 0,
      certain = true;
    const save = () =>
      writeFileSync(
        folder + '/generation-receipt.json',
        JSON.stringify({ ...receipt, costUsd: cost, calls, certain }, null, 2),
      );
    const source = readFileSync('docs/examples/pm121/public/source.png');
    expect(createHash('sha256').update(source).digest('hex')).toBe(identity.sourceSha256);
    const contexts = preparedQuestions.map((q) => ({
      ...q,
      applicationPose: enginePose(q.degrees),
      legalComparisons: [q.degrees - 360, q.degrees + 360]
        .filter((a) => a >= 0 && a <= 720)
        .map(enginePose),
    }));
    const instructions =
      'You are Soma choosing useful visual investigations, not writing more decorative captions. Return bounded data only for each exact prepared question. Choose compare-turns (one revolution away, part=null) or inspect-part (piston,rod,crank at a revealing angle0..720). Choose the best legal action without inventing controls. App computes geometry/valves independently; no arbitrary code. Observed angle MUST match context. Explain the visible contrast or linkage, not measured force, pressure, temperature, efficiency, failure, learner diagnosis or mastery. Source is original synthetic; valve timing idealized, no overlap/advance. All valves seated at boundaries; source stroke descriptions refer to interiors. These are recorded cases, never live adaptive answers. Exact identity and sourceQuote must match supplied values. Each objective says what to observe; explanation<=340chars, title<=65chars. Source facts and application pose facts remain separate.';
    const schema = z.toJSONSchema(investigationSchema);
    delete schema.$schema;
    let correction = '';
    const charge = (e: unknown, model: 'muse-spark-1.3' | 'muse-wonder-1.0') => {
      if (e instanceof MetaClientError) {
        if (e.usage) cost += usageCost(e.usage.input_tokens, e.usage.output_tokens, model);
        else if (e.requestSent) certain = false;
      }
    };
    try {
      await explorationStore.mutate(principal, () => {}, { create: true, acquire: lease });
      acquired = true;
      reservation = await reserveInference(principal.key, 'exploration');
      for (let attempt = 1; attempt <= 2; attempt++) {
        const inputText = JSON.stringify({ identity, sourceQuotes, contexts }) + correction,
          request = {
            instructions,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: inputText },
                  {
                    type: 'input_image',
                    image_url: 'data:image/png;base64,' + source.toString('base64'),
                  },
                ],
              },
            ],
            tools: [],
            deadlineMs: Math.min(30000, deadline - Date.now()),
            maxOutputTokens: 2048,
            reasoningEffort: 'minimal' as const,
            structuredOutput: { name: 'engine_investigations', schema },
          };
        writeFileSync(
          folder + `/request-${attempt}.json`,
          JSON.stringify({ instructions, inputText, ...identity }, null, 2),
        );
        if (
          calls >= 4 ||
          request.deadlineMs <= 0 ||
          cost + visionRequestUpperBoundUsd(request) > 0.35
        )
          throw Error('Operation allowance exhausted');
        let result;
        const t = Date.now();
        try {
          calls++;
          result = await requestMetaVisionResponse(request);
          cost += usageCost(result.usage.input_tokens, result.usage.output_tokens);
        } catch (e) {
          charge(e, 'muse-spark-1.3');
          throw e;
        }
        writeFileSync(folder + `/author-${attempt}.json`, JSON.stringify(result, null, 2));
        attempts.push({ stage: 'author', durationMs: Date.now() - t, usage: result.usage });
        save();
        let data;
        try {
          if (result.status !== 'completed') throw Error('Incomplete author');
          data = validateInvestigations(result.structured);
        } catch (e) {
          correction =
            ' Repair exact candidate:' +
            JSON.stringify(result.structured) +
            ' Validation:' +
            (e as Error).message;
          if (attempt === 2) throw e;
          continue;
        }
        const reviewText =
          JSON.stringify({ sourceQuotes, identity, contexts, candidate: data }) +
          ' Review source/pose factual fit, meaningful action choice and clarity. No thermodynamic/learning claims. Compare must preserve same linkage positions with different stroke roles. Inspect must name actualpart. Advisory only. Reject substantive mistakes; max3 concise issues.';
        if (
          calls >= 4 ||
          Date.now() >= deadline ||
          cost + (Buffer.byteLength(reviewText) * 4 + 2048 * 20) / 1e6 > 0.35
        )
          throw Error('Review allowance exhausted');
        let review;
        const rt = Date.now();
        try {
          calls++;
          review = await requestMetaResponse({
            instructions:
              'Review the recorded Soma investigation. No source inventions or certification.',
            input: [{ role: 'user', content: reviewText }],
            tools: [],
            model: 'muse-wonder-1.0',
            deadlineMs: Math.min(30000, deadline - Date.now()),
            maxOutputTokens: 2048,
            reasoningEffort: 'minimal',
            structuredOutput: {
              name: 'review',
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
          charge(e, 'muse-wonder-1.0');
          throw e;
        }
        writeFileSync(folder + `/review-${attempt}.json`, JSON.stringify(review, null, 2));
        const verdict = z
          .strictObject({ approved: z.boolean(), issues: z.array(z.string()) })
          .parse(review.structured);
        attempts.push({
          stage: 'advisory',
          durationMs: Date.now() - rt,
          usage: review.usage,
          verdict,
        });
        save();
        if (review.status !== 'completed' || !verdict.approved) {
          correction =
            'Repair exact candidate:' +
            JSON.stringify(data) +
            ' Issues:' +
            JSON.stringify(verdict.issues);
          if (attempt === 2) throw Error('Advisory rejected');
          continue;
        }
        writeFileSync(folder + '/investigations.json', JSON.stringify(data, null, 2));
        receipt.status = 'authored-validated-reviewed';
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
      receipt.finishedAt = new Date().toISOString();
      receipt.elapsedMs = Date.now() - started;
      receipt.after = await ledger();
      save();
    }
  },
  120000,
);
