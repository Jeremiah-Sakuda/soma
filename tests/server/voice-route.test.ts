import {beforeEach,describe,it,expect,vi} from 'vitest';
import {encodeVoiceWav} from '../../src/lib/domain/voice-audio';
import {requireSameOrigin} from '../../src/lib/server/http';
import {ExplorationError} from '../../src/lib/server/exploration-types';
const mocks=vi.hoisted(()=>({resolve:vi.fn(),transcribe:vi.fn()}));
vi.mock('../../src/lib/server/exploration-store',()=>({assertExplorationOrigin:(request:Request)=>requireSameOrigin(request),resolveExplorationPrincipal:mocks.resolve,explorationStore:{},revalidateExplorationPrincipal:vi.fn()}));
vi.mock('../../src/lib/server/voice-transcribe',async importOriginal=>{const actual=await importOriginal<typeof import('../../src/lib/server/voice-transcribe')>();return{...actual,transcribeVoice:mocks.transcribe};});
import {POST} from '../../src/app/api/explore/transcribe/route';
const principal={kind:'guest',id:'a'.repeat(64),workspaceId:'a'.repeat(64),generation:'a'.repeat(64),key:'original-test'};
const request=(origin='https://soma.example')=>new Request('https://soma.example/api/explore/transcribe',{method:'POST',headers:{origin,'content-type':'audio/wav'},body:new Uint8Array(encodeVoiceWav(new Float32Array(24000)))});
beforeEach(()=>{vi.clearAllMocks();mocks.resolve.mockResolvedValue({principal});mocks.transcribe.mockResolvedValue({transcript:'Original synthetic question',audioDurationMs:1000,provider:'meta',model:'muse-voice-transcribe-1.0'});});
describe('voice endpoint principal and browser-origin boundary',()=>{
 it('requires exact same origin before resolving identity or reading/transcribing audio',async()=>{const response=await POST(request('https://foreign.example'));expect(response.status).toBe(403);expect(mocks.resolve).not.toHaveBeenCalled();expect(mocks.transcribe).not.toHaveBeenCalled();expect(await response.json()).toMatchObject({code:'forbidden'});});
 it('uses only the existing verified account/guest principal and never creates a guest for audio',async()=>{const source=request(),response=await POST(source);expect(response.status).toBe(200);expect(mocks.resolve).toHaveBeenCalledWith(source,{createGuest:false});expect(mocks.transcribe).toHaveBeenCalledWith(principal,expect.any(Uint8Array),source.signal);expect(response.headers.get('cache-control')).toBe('private, no-store');});
 it('does not fall back to an anonymous identity when account authorization is stale',async()=>{mocks.resolve.mockRejectedValue(new ExplorationError('account_required'));const response=await POST(request());expect(response.status).toBe(401);expect(mocks.transcribe).not.toHaveBeenCalled();});
 it('withholds transcript on a post-processing account generation fence failure',async()=>{mocks.transcribe.mockRejectedValue(new ExplorationError('forbidden'));const response=await POST(request());expect(response.status).toBe(403);expect(await response.text()).not.toContain('Original synthetic question');});
 it('sanitizes unknown provider failures and never echoes raw error facts',async()=>{mocks.transcribe.mockRejectedValue(new Error('secret-key private-provider-transcript'));const response=await POST(request());expect(response.status).toBe(503);const text=await response.text();expect(text).not.toContain('secret-key');expect(text).not.toContain('private-provider-transcript');});
});
