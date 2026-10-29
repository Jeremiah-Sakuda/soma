import {resolveEgressTarget as resolve, startEgressProxy as start, EgressPolicyError} from '../browser-runner/egress.mjs';
export {EgressPolicyError,isPublicAddress} from '../browser-runner/egress.mjs';
function policy(options={}) {
 const {allowedHosts,...rest}=options;
 if(!Array.isArray(allowedHosts)||!allowedHosts.length||allowedHosts.some(host=>!['learn.bu.edu','shib.bu.edu'].includes(host)))throw new EgressPolicyError();
 return {...rest,allowedHosts:[...allowedHosts]};
}
export const resolveEgressTarget=(destination,options)=>resolve(destination,policy(options));
export const startEgressProxy=options=>start(policy(options));
