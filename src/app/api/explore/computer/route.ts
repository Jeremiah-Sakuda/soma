import {NextResponse} from 'next/server';
import {assertExplorationOrigin,resolveExplorationPrincipal} from '@/lib/server/exploration-store';
import {planComputerAction} from '@/lib/server/computer-actions';
import {readJsonBody} from '@/lib/server/http';
import {ZodError} from 'zod';
export const runtime='nodejs';export const maxDuration=40;
export async function POST(request:Request){
 try{assertExplorationOrigin(request);const {principal}=await resolveExplorationPrincipal(request,{createGuest:false});
 const result=await planComputerAction(principal,await readJsonBody(request,18000),request.signal);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const candidate=error as {status?:unknown};const status=typeof candidate?.status==='number'&&[400,401,403,404,409,413,415,422,429,503,504].includes(candidate.status)?candidate.status:error instanceof ZodError?422:503;return NextResponse.json({error:'Computer action could not be prepared. No action was executed.'},{status,headers:{'Cache-Control':'no-store'}});}
}
