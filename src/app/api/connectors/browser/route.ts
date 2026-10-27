import { auditedSourceCollection } from '@/lib/server/source-audit';
import { NextResponse } from 'next/server';
import { verifyAccountSession } from '@/lib/server/account';
import { apiError, requireSameOrigin, readJsonBody } from '@/lib/server/http';
import { listConnections } from '@/lib/server/connectors/store';
import { queueCollectedPreparation } from '@/lib/server/connectors/preparation';
import { BROWSER_PROVIDERS, browserActionSchema, browserConfigured, completeBrowserLogin, configureBrowser, disconnectBrowser, refreshBrowser, startBrowserLogin } from '@/lib/server/connectors/browser';
export const runtime = 'nodejs';
export const maxDuration = 120;
const response = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
function browserError(error: unknown) {
  const known = error as { status?: number; code?: string };
  if (known.status === 503 && known.code?.startsWith('browser_')) return NextResponse.json({ error: known.code === 'browser_configuration' ? 'Browser connections are not configured yet.' : 'The browser service is unavailable. Saved authorization was retained; try again.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  return apiError(error);
}
async function account(request: Request) {
  const value = await verifyAccountSession(request);
  if (!value) throw Object.assign(new Error('Sign in to connect a private source.'), { status: 401 });
  return value;
}
export async function GET(request: Request) {
  try { const connections = await listConnections(await account(request)); return response({ configured: browserConfigured(), providers: Object.entries(BROWSER_PROVIDERS).map(([provider, { label, homeUrl }]) => ({ provider, label, homeUrl, connection: connections.find(item => item.id === `browser-${provider}`) })) }); }
  catch (error) { return browserError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const owner = await account(request);
    const parsed = browserActionSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw Object.assign(new Error('Invalid source settings.'), { status: 400 });
    const { provider, action, targets } = parsed.data;
    if (action === 'configure') return response(await configureBrowser(owner, provider, targets ?? []));
    if (targets) throw Object.assign(new Error('Save selected pages before starting a browser action.'), { status: 400 });
    if (action === 'start') return response(await startBrowserLogin(owner, provider));
    if (action === 'complete') return response(await completeBrowserLogin(owner, provider));
    if (action === 'disconnect') return response(await disconnectBrowser(owner, provider));
    const collected = await auditedSourceCollection(owner, provider, () => refreshBrowser(owner, provider), value => value.workspace);
    const result = collected.value;
    if (!collected.auditComplete) return response({ ...result, notice: 'The selected sources were saved, but final audit confirmation is incomplete. Background handoff can recover from durable sources.' });
    result.notice += await queueCollectedPreparation(owner, result.workspace, `${provider}:browser-${provider}:`);
    return response(result);
  } catch (error) { return browserError(error); }
}
