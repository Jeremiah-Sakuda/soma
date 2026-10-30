import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/server/http';
import { assertExplorationOrigin, resolveExplorationPrincipal, explorationStore } from '@/lib/server/exploration-store';
import { projectCompanionMemory, mutateCompanionMemory } from '@/lib/server/companion-memory';
import { analyzeCompanionMemory } from '@/lib/server/companion-analysis';
import { inferenceEnabled } from '@/lib/server/budget';
import { ExplorationError } from '@/lib/server/exploration-types';
export const runtime='nodejs';
export const maxDuration=75;
const response=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
function failure(error:unknown){const status=(error as {status?:number})?.status;const safe=error instanceof ExplorationError?error:new ExplorationError(status===401?'account_required':status===403?'forbidden':status===400||status===413||status===415?'invalid_request':'unavailable');return response({error:safe.message,code:safe.code},safe.status);}
export async function GET(request:Request){try{const {principal}=await resolveExplorationPrincipal(request);const session=await explorationStore.read(principal);if(!session)throw new ExplorationError('session_expired');return response({memory:projectCompanionMemory(session),kind:principal.kind,liveEnabled:inferenceEnabled()});}catch(e){return failure(e);}}
export async function PATCH(request:Request){try{assertExplorationOrigin(request);const {principal}=await resolveExplorationPrincipal(request);return response({memory:await mutateCompanionMemory(principal,await readJsonBody(request,12000))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{assertExplorationOrigin(request);const {principal}=await resolveExplorationPrincipal(request);return response(await analyzeCompanionMemory(principal,await readJsonBody(request,2000),request.signal));}catch(e){return failure(e);}}
export async function DELETE(request:Request){try{assertExplorationOrigin(request);const {principal}=await resolveExplorationPrincipal(request);const body=z.strictObject({revision:z.number().int().nonnegative()}).safeParse(await readJsonBody(request,1000));if(!body.success)throw new ExplorationError('invalid_request');return response({memory:await mutateCompanionMemory(principal,{action:'reset',revision:body.data.revision})});}catch(e){return failure(e);}}
