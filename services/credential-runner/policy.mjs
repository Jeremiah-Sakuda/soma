// Reviewed BU contract only. Any new identity provider needs a separate review.
export const PROVIDER = 'blackboard';
export const LOGIN_ORIGIN = 'https://shib.bu.edu';
export const START_URL = 'https://learn.bu.edu/';
export const ALLOWED_HOSTS = ['learn.bu.edu', 'shib.bu.edu'];
export function allowedOrigin(provider, origin) {
  return provider === PROVIDER && origin === LOGIN_ORIGIN;
}
export function allowedUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ALLOWED_HOSTS.includes(url.hostname)
    );
  } catch {
    return false;
  }
}
export function checkFormFacts(facts) {
  if (
    !facts ||
    facts.topOrigin !== LOGIN_ORIGIN ||
    facts.frameCount !== 1 ||
    facts.pageCount !== 1 ||
    facts.forms !== 1 ||
    facts.passwords !== 1 ||
    facts.identifiers !== 1 ||
    facts.method !== 'post' ||
    facts.target ||
    facts.actionOrigin !== LOGIN_ORIGIN ||
    !/^\/idp\/profile\/SAML2\/(?:Redirect|POST)\/SSO$/.test(facts.actionPath) ||
    facts.identifierType !== 'text' ||
    facts.passwordType !== 'password' ||
    facts.submitters !== 1
  )
    throw Object.assign(new Error('Reviewed login form unavailable.'), {
      code: 'form_not_reviewed',
      status: 409,
    });
  return true;
}
export function validIdentifier(value) {
  return typeof value === 'string' && /^(?:[a-zA-Z][a-zA-Z0-9._-]{0,63})(?:@bu\.edu)?$/.test(value);
}
