import type {CheckedExploration} from '../domain/exploration';
import type {VerifiedAccount} from './account';

export type ExplorationPrincipal={kind:'account'|'guest';id:string;workspaceId:string;generation:string;key:string;account?:VerifiedAccount};
export type ExplorationSource={observationId:string;version:number;kind:'screenshot'|'example';label:string;capturedAt:string;summary:string;uncertainty:string[]};
export type ExplorationViewState={step:number;explanationStep:number;start:string|null;goal:string|null;disabledEdgeIds:string[];reversed:boolean;selectedObjectId:string|null};
export type ExplorationAudit={event:'source-interpreted'|'model-computed'|'scene-validated'|'repair-requested';call:number;detail:string};
export type ExplorationArtifact=CheckedExploration&{
 id:string;version:number;createdAt:string;updatedAt:string;question:string;source:ExplorationSource;
 generation:{mode:'live'|'prepared-example';provider:'meta'|'none';model:'muse-spark-1.3'|null;calls:number;usage:{input_tokens:number;output_tokens:number};costUsd:number;elapsedMs:number;checks:string[];audit:ExplorationAudit[]};
 state:ExplorationViewState;saved:boolean;
};
export type ExplorationRun={requestId:string;status:'generating'|'cancelled'|'failed'|'published';startedAt:string;deadline:string;artifactId:string;version:number;code?:string;calls?:number;costUsd?:number};
export type ExplorationSession={schemaVersion:1;owner:string;workspaceId:string;generation:string;createdAt:string;expiresAt:string;revision:number;artifacts:ExplorationArtifact[];runs:ExplorationRun[];activeRequestId:string|null};
export type ExplorationStore={read(principal:ExplorationPrincipal):Promise<ExplorationSession|null>;mutate(principal:ExplorationPrincipal,change:(session:ExplorationSession)=>void,options?:{create?:boolean;acquire?:string;release?:string}):Promise<ExplorationSession>};

const errors={invalid_request:[400,'Check the image, question and exploration details.'],session_expired:[401,'This exploration session expired. Refresh to start a new one.'],account_required:[401,'Please sign in again.'],forbidden:[403,'This exploration belongs to a different session.'],not_found:[404,'This exploration could not be found.'],revision_conflict:[409,'This exploration changed. Reopen the latest version and try again.'],cancelled:[409,'This request was cancelled. Your previous exploration is unchanged.'],busy:[429,'Another exploration is running. Please try again shortly.'],capacity:[429,'The exploration limit has been reached. Please try again later.'],image_invalid:[422,'Choose a readable PNG or JPEG image under 512 KB and 1600 pixels per side.'],generation_invalid:[422,'Soma could not validate the generated explanation. Your previous exploration is unchanged.'],unavailable:[503,'Live exploration is unavailable right now. Your saved exploration is unchanged.'],timeout:[504,'The explanation took too long. Your previous exploration is unchanged.']} as const;
export type ExplorationErrorCode=keyof typeof errors;
export class ExplorationError extends Error{status:number;constructor(public code:ExplorationErrorCode){super(errors[code][1]);this.status=errors[code][0];}}
