import {assertExplorationOrigin,resolveExplorationPrincipal} from '@/lib/server/exploration-store';
import {ExplorationError} from '@/lib/server/exploration-types';
import {speakExploration,GeminiSpeechError,GEMINI_TTS_MODEL} from '@/lib/server/gemini-speech';
import {readJsonBody} from '@/lib/server/http';
export const runtime='nodejs';
export const maxDuration=40;
export async function POST(request:Request){
 try{
  try{assertExplorationOrigin(request);}catch{throw new ExplorationError('forbidden');}
  const {principal}=await resolveExplorationPrincipal(request,{createGuest:false});
  let body:unknown;try{body=await readJsonBody(request,4096);}catch{throw new GeminiSpeechError('invalid');}
  const audio=await speakExploration(principal,body,request.signal);
  return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/wav','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Soma-Voice-Model':GEMINI_TTS_MODEL}});
 }catch(error){const safe=error instanceof GeminiSpeechError||error instanceof ExplorationError?error:new GeminiSpeechError('unavailable');return Response.json({error:safe.message,code:safe.code},{status:safe.status,headers:{'Cache-Control':'no-store'}});}
}
