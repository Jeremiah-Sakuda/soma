import {NextResponse} from 'next/server';
import {verifyAccountSession,AccountSessionError} from '@/lib/server/account';
import {apiError,requireSameOrigin,readJsonBody} from '@/lib/server/http';
import {blackboardStatus,blackboardActionSchema,discoverBlackboardCourses,selectBlackboardCourses} from '@/lib/server/connectors/blackboard';
export const runtime='nodejs';
export const maxDuration=120;
const response=(value:unknown)=>NextResponse.json(value,{headers:{'Cache-Control':'private, no-store'}});
async function account(request:Request){const owner=await verifyAccountSession(request);if(!owner)throw new AccountSessionError('Sign in to manage Blackboard.',401,'account_required');return owner;}
export async function GET(request:Request){try{return response(await blackboardStatus(await account(request)));}catch(error){return apiError(error);}}
export async function POST(request:Request){try{requireSameOrigin(request);const owner=await account(request),input=blackboardActionSchema.safeParse(await readJsonBody(request));if(!input.success)throw Object.assign(new Error('Invalid Blackboard selection.'),{status:400});return response(input.data.action==='discover'?await discoverBlackboardCourses(owner,input.data.query,input.data.more):await selectBlackboardCourses(owner,input.data.courseIds,input.data.mappings));}catch(error){return apiError(error);}}
