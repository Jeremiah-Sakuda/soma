import {NextResponse} from 'next/server';
import {assertExplorationOrigin,resolveExplorationPrincipal} from '@/lib/server/exploration-store';
import {planComputerAction} from '@/lib/server/computer-actions';
import {ExplorationError} from '@/lib/server/exploration-types';
import {ZodError} from 'zod';
export const runtime='nodejs';export const maxDuration=40;
export async function POST(request:Request){
 try{assertExplorationOrigin(request);const {principal}=await resolveExplorationPrincipal(request,{createGuest:false});
 const reader=request.body?.getReader();if(!reader)throw new ZodError([]);let bytes=0;const chunks:Uint8Array[]=[];try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>18000){await reader.cancel();return NextResponse.json({error:'Request too large.'},{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
 const result=await planComputerAction(principal,JSON.parse(Buffer.concat(chunks).toString('utf8')),request.signal);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const status=error instanceof ExplorationError?error.status:error instanceof ZodError||error instanceof SyntaxError?422:503;return NextResponse.json({error:'Computer action could not be prepared. No action was executed.'},{status,headers:{'Cache-Control':'no-store'}});}
}
