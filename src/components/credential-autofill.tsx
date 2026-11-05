'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Availability = {
  configured: boolean;
  origin?: string;
  providers: {
    provider: string;
    available: boolean;
    stored?: boolean;
    notice?: string;
    active?: { expiresAt: string };
  }[];
};
type SignInWindow = { loginUrl?: string; expiresAt: string };
type Props = {
  disabled?: boolean;
  onActiveChange: (active: boolean) => void;
  onComplete: () => Promise<void>;
};

// Match only reviewed broker messages, never render an arbitrary service body.
const recoveryMessages = new Map<string, string>([
  [
    '409:Finish the manual sign-in window in Soma before setting up secure autofill.',
    'A manual sign-in window is still active. Use “Reconnect BU Blackboard” above to reopen it, finish signing in, then choose “I’ve finished signing in” before trying secure autofill again.',
  ],
  [
    '409:The previous manual sign-in could not be confirmed ended. Reconnect or finish it before setting up secure autofill.',
    'The previous manual sign-in could not be confirmed ended. Reconnect or finish it above before setting up secure autofill.',
  ],
  [
    '409:Finish or cancel the existing secure sign-in before opening another.',
    'A secure sign-in is already pending. Finish it or use “Cancel secure sign-in” below before starting again.',
  ],
  [
    '409:No secure sign-in is pending.',
    'No secure sign-in is pending. Start a new setup when you are ready.',
  ],
  [
    '409:This source is already in use. Try again shortly.',
    'Soma is using this source. Wait for that check to finish, then try again.',
  ],
  [
    '409:Reconnect this provider with the Google Cloud browser before setting up secure autofill.',
    'Reconnect Blackboard using the manual connection above before setting up secure autofill.',
  ],
  [
    '429:This provider has reached today’s browser-session limit.',
    'Today’s browser-session limit has been reached. Finish any open sign-in window or try again tomorrow.',
  ],
  [
    '403:Secure autofill is not available for this account. You can still use manual sign-in.',
    'Secure autofill is not enabled for this account. Use the manual connection above.',
  ],
]);

// This component handles only the broker's status and one-use window address.
// Credential entry, consent, storage and forgetting belong to the isolated service.
async function request(action?: 'open' | 'complete' | 'cancel' | 'forget') {
  const response = await fetch('/api/connectors/credentials', {
    method: action ? 'POST' : 'GET',
    cache: 'no-store',
    ...(action
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, provider: 'blackboard' }),
        }
      : {}),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const authored =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : '';
    const recovery = recoveryMessages.get(`${response.status}:${authored}`);
    if (recovery) throw new Error(recovery);
    if (response.status === 401 || response.status === 403)
      throw new Error(
        'For your security, sign out of Soma and sign in again before setting up secure autofill.',
      );
    throw new Error(
      'Secure autofill did not finish. Check for a pending sign-in below and cancel it before trying again.',
    );
  }
  return response.json();
}

export function CredentialAutofill({ disabled = false, onActiveChange, onComplete }: Props) {
  const [availability, setAvailability] = useState<Availability>();
  const [session, setSession] = useState<SignInWindow>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const errorId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const applyAvailability = useCallback(
    (value: Availability) => {
      setAvailability(value);
      const active = value.providers.find((item) => item.provider === 'blackboard')?.active;
      if (active && Number.isFinite(Date.parse(active.expiresAt))) {
        setSession((current) =>
          current?.expiresAt === active.expiresAt ? current : { expiresAt: active.expiresAt },
        );
        onActiveChange(true);
      } else {
        setSession(undefined);
        onActiveChange(false);
      }
    },
    [onActiveChange],
  );
  const read = useCallback(async () => {
    applyAvailability(await request());
  }, [applyAvailability]);
  useEffect(() => {
    let active = true;
    void request()
      .then((value: Availability) => {
        if (active) applyAvailability(value);
      })
      .catch((err: unknown) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Secure autofill is unavailable.');
      });
    return () => {
      active = false;
    };
  }, [applyAvailability]);
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error, session?.expiresAt]);
  const available =
    availability?.configured &&
    !!availability.origin &&
    availability.providers.some((item) => item.provider === 'blackboard' && item.available);
  const canForget =
    availability?.configured ||
    availability?.providers.some(
      (item) => item.provider === 'blackboard' && (item.stored || item.active),
    );

  async function run(action: 'open' | 'complete' | 'cancel' | 'forget') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(action);
      if (action === 'open') {
        const address = new URL(result.loginUrl);
        const end = Date.parse(result.expiresAt);
        if (
          address.protocol !== 'https:' ||
          address.origin !== availability?.origin ||
          address.username ||
          address.password ||
          address.port ||
          address.search ||
          !/^\/login\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            address.pathname,
          ) ||
          !/^#[A-Za-z0-9_-]{43}$/.test(address.hash) ||
          !Number.isFinite(end) ||
          end <= Date.now()
        ) {
          throw new Error(
            'The isolated sign-in address was not available. Cancel this attempt and try manual sign-in.',
          );
        }
        setSession({ loginUrl: address.href, expiresAt: result.expiresAt });
        setExpired(false);
        onActiveChange(true);
      } else {
        setSession(undefined);
        setExpired(false);
        onActiveChange(false);
        if (action === 'complete') {
          setNotice(
            'Sign-in session saved. This does not verify course access; refresh your selected courses to check it.',
          );
          await onComplete();
        } else if (action === 'forget')
          setNotice(
            'Optional stored sign-in removed and pending secure sign-in cancelled. This does not sign you out of BU or remove saved browser access.',
          );
        else
          setNotice(
            'Secure sign-in cancelled. Cancelling the window does not forget a password already saved in the vault.',
          );
        await read();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Secure autofill is unavailable.');
      // Allocation can fail after its durable cleanup reference was saved.
      // Recover those controls; never silently cancel or forget on the user.
      if (action === 'open') await read().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-status" aria-label="Optional Blackboard credential autofill">
      <h3>Optional secure autofill</h3>
      <p>
        Manual sign-in remains available. For BU Blackboard only, you can choose to store a password
        in Soma’s separate encrypted vault. Password entry and consent are on the isolated sign-in
        service, never in this Soma form.
      </p>
      <p>
        The trusted login service and BU must briefly process your password. Soma’s AI and course
        collector do not receive it. You still complete MFA yourself. You can forget stored sign-in
        here. Disconnect removes both stored sign-in and saved browser access.
      </p>
      {!availability && !error && <p role="status">Checking secure autofill availability…</p>}
      {availability && !available && (
        <p className="inline-caution">
          Secure autofill is not enabled on this deployment. Use the manual connection above.
        </p>
      )}
      <div className="action-row" style={{ marginTop: 16 }}>
        {!session && (
          <button
            type="button"
            className="secondary-button"
            aria-describedby={error ? errorId : undefined}
            disabled={disabled || busy || !available}
            onClick={() => void run('open')}
          >
            Set up secure autofill
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy || !canForget}
          onClick={() => void run('forget')}
        >
          Forget stored sign-in
        </button>
      </div>
      {session && (
        <>
          {session.loginUrl && (
            <p style={{ overflowWrap: 'anywhere' }}>
              Separate sign-in service: <strong>{new URL(session.loginUrl).origin}</strong>
            </p>
          )}
          {!session.loginUrl && (
            <p>
              A secure sign-in attempt is pending. If you finished in its sign-in window, save the
              session below. If the window did not open or you lost it, cancel this attempt and
              start again; Soma does not retain its one-use link.
            </p>
          )}
          <p>
            {expired
              ? 'This sign-in window has expired. Cancel this attempt before starting again.'
              : `This window is available until ${new Date(session.expiresAt).toLocaleTimeString()}. Enter credentials only after checking the service address.`}
          </p>
          <div className="action-row" style={{ marginTop: 16 }}>
            {!expired && session.loginUrl && (
              <a
                className="primary-button"
                href={session.loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Open isolated sign-in service
              </a>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || busy || expired}
              onClick={() => void run('complete')}
            >
              Save sign-in session
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void run('cancel')}
            >
              Cancel secure sign-in
            </button>
          </div>
          <p>
            Finish signing in and any MFA before saving. A saved session does not establish that
            your selected course material is readable.
          </p>
        </>
      )}
      {busy && <p role="status">Secure sign-in request in progress…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <>
          <p ref={errorRef} id={errorId} role="alert" tabIndex={-1} className="inline-error">
            {error}
          </p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void read()
                .catch(() => undefined)
                .finally(() => setBusy(false));
            }}
          >
            Check secure sign-in status
          </button>
        </>
      )}
    </section>
  );
}
