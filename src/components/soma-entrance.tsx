'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ScanLine, X } from 'lucide-react';
import { AccountPanel } from './account-panel';
import type { WorkspaceResponse } from '@/lib/domain/types';
import styles from './soma-entrance.module.css';

export function SomaEntrance({ openDemo, accountReady, onUpdate, error, retry, oauthReturn, recoverAccount, beforeSessionChange, onSessionChangeFailed }: {
  openDemo: () => void; accountReady: () => Promise<void>; onUpdate: (response: WorkspaceResponse) => void;
  recoverAccount?: boolean; beforeSessionChange?: () => void; onSessionChangeFailed?: () => void; error?: string; retry: () => void; oauthReturn?: 'connected' | 'error' | null;
}) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(oauthReturn || recoverAccount ? 'signin' : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (authMode) dialog.current?.showModal(); else dialog.current?.close(); }, [authMode]);
  return <div className={styles.entrance}>
    <a className="skip-link" href="#entrance-main">Skip to content</a>
    <header className={styles.header}>
      <a className={styles.wordmark} href="/" aria-label="Soma home"><ScanLine size={20} aria-hidden="true"/>Soma</a>
      <nav className={styles.accountActions} aria-label="Your account"><button className={styles.textButton} onClick={() => setAuthMode('signin')}>Sign in</button><button className={styles.accountButton} onClick={() => setAuthMode('signup')}>Create account</button></nav>
    </header>
    <main className={styles.main} id="entrance-main" tabIndex={-1}>
      {error && <div className="alert error" role="alert"><span>{error}</span><button className="text-button" onClick={retry}>Retry account check</button></div>}
      <section className={styles.hero} aria-labelledby="entrance-title">
        <p className={styles.eyebrow}>An explanation, beside your work.</p>
        <h1 className={styles.title} id="entrance-title">Understand what's on your screen.</h1>
        <p className={styles.lede}>Capture a slide, a problem, or an idea. Soma turns it into a visual explanation you can explore.</p>
        <a className={styles.primaryAction} href="/explore"><ScanLine size={19} aria-hidden="true"/>Capture &amp; explore<ArrowRight size={17} aria-hidden="true"/></a>
        <p className={styles.note}>No account needed. Review your capture before sending.</p>
        <p className={styles.browserNote}>In your browser, choose a window or upload a screenshot.</p>
      </section>
      <footer className={styles.footer}>
        <p>Visual explanations by Meta Muse Spark.</p>
        <div className={styles.legacy}><span>Course workspace · original synthetic demo</span><button className={styles.textButton} onClick={openDemo}>Try quick demo <ArrowRight size={14} aria-hidden="true"/></button></div>
      </footer>
    </main>
    <dialog ref={dialog} className="workspace-dialog" aria-labelledby="entrance-account-title" onCancel={() => setAuthMode(null)} onClick={event => { if (event.target === event.currentTarget) setAuthMode(null); }}>
      <div className="dialog-content"><div className="dialog-header"><h2 id="entrance-account-title">{authMode === 'signup' ? 'Create your Soma account' : 'Welcome back'}</h2><button className="icon-button" aria-label="Close account dialog" onClick={() => setAuthMode(null)}><X size={20}/></button></div>
        {recoverAccount && error && <p className="alert" role="alert">{error}</p>}
        {oauthReturn && <p className="alert" role="status">{oauthReturn === 'error' ? 'Google authorization did not complete. Sign in to your Soma account to retry the connection.' : 'Sign in to your Soma account to inspect the returned Google connection.'}</p>}
        {authMode && <AccountPanel key={authMode} initialMode={authMode} reload={accountReady} onSignedIn={accountReady} beforeSessionChange={beforeSessionChange} onSessionChangeFailed={onSessionChangeFailed} onUpdate={onUpdate}/>}
      </div>
    </dialog>
  </div>;
}
