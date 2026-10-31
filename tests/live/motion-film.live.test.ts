import { it, expect } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { motionFilmSchema, validateFilm, filmFrame } from '../../docs/examples/pm120/lib/motion-film';
import { requestMetaVisionResponse, visionRequestUpperBoundUsd } from '../../src/lib/server/meta-vision';
import { requestMetaResponse, MetaClientError } from '../../src/lib/server/meta-client';
import { reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
it.skipIf(process.env.SOMA_MOTION_FILM_LIVE !== 'true')('authors and reviews a real same-source film within retained admission and budget limits', async () => {
  expect(process.env.SOMA_PERSISTENCE).toBe('firestore'); expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
  const folder = process.env.SOMA_MOTION_FILM_OUTPUT || `.local/pm120/live-${Date.now()}`; mkdirSync(folder, { recursive: true });
  const id = randomBytes(32).toString('hex'), principal: ExplorationPrincipal = { kind: 'guest', id, workspaceId: id, generation: id, key: `guest-${id}` }, lease = randomUUID();
  const ledger = async () => Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0);
  const receipt: Record<string, unknown> = { startedAt: new Date().toISOString(), before: await ledger(), cap: Number(process.env.META_APP_SPEND_CAP_USD), mode: 'actual Muse generation on an original synthetic source', attempts: [] };
  let reservation: string | undefined, acquired = false, certain = true, cost = 0, calls = 0;
  const started = Date.now(), deadline = started + 90000, attempts = receipt.attempts as unknown[];
  const save = () => writeFileSync(`${folder}/generation-receipt.json`, JSON.stringify({ ...receipt, calls, costUsd: cost, certain }, null, 2));
  const source = readFileSync('docs/examples/pm117/public/sources/piston.png');
  const instructions = `You are Soma's motion designer. Author an original polished 24-second educational vector film from the supplied source using motion-film-v1, not executable code. You author the artwork, paths, composition, grouping, palette, typography, explanatory captions, narration and timed choreography. Source facts: fixed open guide/base; a wide piston head, rod and top grip slide vertically as a rigid connected group. No fluid, force, pressure or checked physics claim. Label chosen dimensions and travel as illustrative assumptions. We compare this to a previous 3D-derived illustration of the same source.
Design a crafted editorial teaching film at640x460: warm light paper, charcoal text, sage guide, copper head, gold grip, clear dark outlines. Meaningful close framing, strong negative space, no card UI inside the drawing. Use18-32 concise nodes, <=8 styles, <=12 tracks, custom paths for details/arrow callouts, large readable type>=28. At most3 short labels visible at once, beside the mechanism without collision. Keep bounds inside a24px margin including movement. Text must fit: at font28 estimate 15pixels per letter, so right labels atx452 may be at most10letters. Use short words such as Guide, Head, Rod, Grip; avoid collisions. All visible head x bounds must lie strictly inside the guide opening. Include a few crafted path details (head grooves, rod highlight, grip contour) with purposeful callout lines; do not merely draw four undecorated rectangles. Text starts top-left(x,y), hanging baseline; no multiline. A node's x/y translates its shape; children inherit group transforms. shape is SVG path d ONLY for path nodes, empty otherwise. text is nonempty ONLY for text nodes. Rect/circle sizes describe only those kinds; unused numeric fields0. Styles must be referenced. Groups do not override child styles.
Exactly one node each with role base/head/rod/grip: actual visible shapes, not labels. Head/rod/grip share the parameter target group. The parameter drives only that group, ty positive downward. In the experiment frame rod bottom touches head top and rod top touches grip bottom; head stays visibly ABOVE base at compression1. Guide/base fixed. Do not scale/rotate individual movers. ALL text nodes must have parentId null, always outside moving groups. NEVER add tx/ty/scale/rotate tracks: physical translation is applied ONLY by parameter.amount times $compression. Tracks may animate opacity/reveal of annotations and $compression:value ONLY. For gap annotation avoid numeric measurements or constant-gap claims; the gap decreases and remains positive. Prefer a continuously connected assembly; any introduction separation must be explicitly explained then reconnected. Put roles on actual shape nodes.
Exactly4 chapters at0,6,12,18 seconds, duration24, experimentAt18. Each narration <=12 spoken words; concise captions. Author $compression:value with0 at0and6, smoothly1 by16, then hold1 through24. Introduce the mechanism, reveal shared movement, compress, recap what stayed fixed. Add purposeful staged label/arrow appearances and drawing reveal. Tracks target node IDs, opacity/reveal0..1. Transform tracks are OFFSETS, not absolute x/y. No external assets or arbitrary expressions. All mechanism parts remain visible at the final frame. Aim for an authored motion explanation, not a static diagram with a play button.`;
  const schema = z.toJSONSchema(motionFilmSchema); delete schema.$schema;
  const chargeError = (e: unknown, model: 'muse-spark-1.3' | 'muse-wonder-1.0') => { if (e instanceof MetaClientError) { if (e.usage) cost += usageCost(e.usage.input_tokens, e.usage.output_tokens, model); else if (e.requestSent) certain = false; } };
  let issues = process.env.SOMA_FILM_REPAIR_FILE ? 'Repair this exact earlier candidate. PRESERVE its node IDs, artwork, path coordinates, style IDs, positions, sizes, text and timing EXCEPT the concrete fixes: set parameter.amount=28 (head bottom302 plus28 is330, safely before base340); fade head and grip callout lines before movement at6 seconds so they do not point at obsolete part positions. Do not move/rebuild the mechanism. Fix all issues without introducing new geometry errors: put every label outside the moving group with parentId null, eliminate any transform track on slide or physical parts (only parameter drives translation), remove gap measurements/marks unless exact; head must stay fully inside open channel and above base; gap decreases during travel, so never say it stays constant. Use a plain Travel control label. Improve the illustration with purposeful custom path details and staged callout lines, but keep clear large labels. Original candidate: '+JSON.stringify(JSON.parse(readFileSync(process.env.SOMA_FILM_REPAIR_FILE, 'utf8'))) : '';
  if (process.env.SOMA_FILM_LAYOUT_FIX === 'true') {
    const original = JSON.parse(readFileSync(process.env.SOMA_FILM_REPAIR_FILE!, 'utf8'));
    issues = 'ONLY repair label overlap in this exact film. Preserve every geometry, parameter, style, chapter and track value, and all IDs. Make ONLY these changes: move lbl-head, lbl-grip, lbl-rod to x520; their y positions remain unchanged. Extend call-head to M420 286 H516, call-grip to M375 168 H516, call-rod to M335 225 H516. Reorder these three callout paths BEFORE guide-r in nodes draw order so the right guide paints over the middle of each leader. Keep labels after guide-r so their text is visible outside it. No other node may move or change shape. Return a complete film with these local layout fixes. Current film: '+JSON.stringify(original);
  }
  try {
    await explorationStore.mutate(principal, () => {}, { create: true, acquire: lease }); acquired = true;
    reservation = await reserveInference(principal.key, 'exploration');
    for (let attempt = 1; attempt <= 2; attempt++) {
      const request = { instructions, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Create the complete film. '+issues }, { type: 'input_image', image_url: `data:image/png;base64,${source.toString('base64')}` }] }], tools: [], deadlineMs: Math.min(30000, deadline - Date.now()), maxOutputTokens: 6144, reasoningEffort: 'minimal' as const, structuredOutput: { name: 'soma_motion_film', schema } };
      writeFileSync(`${folder}/request-${attempt}.json`, JSON.stringify({ instructions, inputText: 'Create the complete film. '+issues, sourceSha256: createHash('sha256').update(source).digest('hex') }, null, 2));
      if (calls >= 4 || request.deadlineMs <= 0 || cost + visionRequestUpperBoundUsd(request) > .35) throw Error('Bounded generation allowance exhausted.');
      const start = Date.now(); let result;
      if (attempt === 1 && process.env.SOMA_FILM_CANDIDATE_FILE) {
        result = { structured: JSON.parse(readFileSync(process.env.SOMA_FILM_CANDIDATE_FILE, 'utf8')) };
        attempts.push({ stage: 'reuse-candidate', path: process.env.SOMA_FILM_CANDIDATE_FILE, newCalls: 0 });
      } else {
        try { calls++; result = await requestMetaVisionResponse(request); cost += usageCost(result.usage.input_tokens, result.usage.output_tokens); } catch (e) { chargeError(e, 'muse-spark-1.3'); throw e; }
        writeFileSync(`${folder}/author-${attempt}.json`, JSON.stringify(result, null, 2)); attempts.push({ stage: 'author', attempt, durationMs: Date.now()-start, usage: result.usage }); save();
      }
      let film;
      try { film = validateFilm(result.structured); } catch (e) { issues = `Previous output failed validation: ${(e as Error).message}. Return a repaired complete film.`; if (attempt===2) throw e; continue; }
      if (process.env.SOMA_FILM_LAYOUT_FIX === 'true') {
        const original = validateFilm(JSON.parse(readFileSync(process.env.SOMA_FILM_REPAIR_FILE!, 'utf8')));
        const allowed = new Set(['lbl-head','lbl-grip','lbl-rod','call-head','call-grip','call-rod']);
        expect(film.parameter).toEqual(original.parameter); expect(film.tracks).toEqual(original.tracks); expect(film.chapters).toEqual(original.chapters); expect(film.styles).toEqual(original.styles);
        for (const node of original.nodes.filter(n=>!allowed.has(n.id))) expect(film.nodes.find(n=>n.id===node.id)).toEqual(node);
      }
      const reviewText = 'Renderer semantics are authoritative: tracks clamp to their FIRST key before that key time, and LAST key after the end; thus a first opacity value0 hides the label before its first key. Caption/layout omissions like a short Fixed label without a leader are cosmetic unless they make a false claim; reject substantive source/math/visibility errors only. Callouts at opacity0 after6s are correctly hidden while the mechanism moves; do not require invisible lines to follow objects. Evaluated runtime snapshots: '+JSON.stringify([0,6,12,18,24].map(t=>{const frame=filmFrame(film,t);return {time:t,compression:frame.compression,poses:frame.poses};}))+' Be concise: return at most 3 short substantive issues. Internal IDs are protocol fields, not scientific claims: id compression is REQUIRED by the schema and must not be renamed. The source explicitly calls it a compression control; do not reject that name alone, only unsupported visible force/pressure claims. Do not require decorative callout lines to touch parts if clearly labels, but flag misleading unchanged pointers. Watch label width: labels at x448 in a640-wide frame must fit inside x616; at font28, 19-character labels likely clip. Review this illustrative 2D educational film against source facts: fixed open guide and base; head, rod and top grip translate together as one connected group. No pressure/force/fluid science supplied. Check source claims, captions, layout/readability, head/base clearance and exact attachment coordinates, accounting for parent transforms and compression ty. Reject substantive errors with concrete corrections. Film: '+JSON.stringify(film);
      const bound = (Buffer.byteLength(reviewText)*4+2048*20)/1e6;
      if (calls>=4 || Date.now()>=deadline || cost+bound>.35) throw Error('Review headroom exhausted.');
      const reviewStart = Date.now(); let review;
      try { calls++; review = await requestMetaResponse({ instructions: 'You are the advisory reviewer for Soma. No source inventions.', input: [{ role: 'user', content: reviewText }], tools: [], model: 'muse-wonder-1.0', deadlineMs: Math.min(30000,deadline-Date.now()), maxOutputTokens: 2048, reasoningEffort: 'minimal', structuredOutput: { name: 'film_review', schema: { type: 'object', additionalProperties: false, required: ['approved','issues'], properties: { approved: { type:'boolean' }, issues:{ type:'array',items:{type:'string'} } } } } }); cost += usageCost(review.usage.input_tokens,review.usage.output_tokens,'muse-wonder-1.0'); } catch(e) { chargeError(e,'muse-wonder-1.0'); throw e; }
      writeFileSync(`${folder}/review-${attempt}.json`,JSON.stringify(review,null,2));
      if (review.status !== 'completed') throw Error('Reviewer output incomplete; retained usage, no accepted film.');
      const verdict = z.object({approved:z.boolean(),issues:z.array(z.string())}).parse(review.structured);
      attempts.push({stage:'review',attempt,durationMs:Date.now()-reviewStart,usage:review.usage,verdict});save();
      if (!verdict.approved) { issues='Reviewer found: '+verdict.issues.join(' ')+' Repair this exact film, preserving ALL geometry, IDs and artwork except the specific fixes. Return a complete corrected film: '+JSON.stringify(film); if(attempt===2)throw Error(issues);continue; }
      writeFileSync(`${folder}/film.json`,JSON.stringify(film,null,2));receipt.status='authored-validated-reviewed';receipt.sourceSha256=createHash('sha256').update(source).digest('hex');receipt.instructions=instructions;break;
    }
    expect(receipt.status).toBe('authored-validated-reviewed');
  } catch(e) { receipt.status='failed';receipt.code=(e as Error).message;throw e; }
  finally {
    if(reservation)await settleInference(reservation,cost,certain);
    if(acquired)await explorationStore.mutate(principal,()=>{},{release:lease});
    receipt.elapsedMs=Date.now()-started;receipt.finishedAt=new Date().toISOString();receipt.after=await ledger();save();
  }
},150000);
