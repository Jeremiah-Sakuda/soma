'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Layers3, SlidersHorizontal, X } from 'lucide-react';
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
    <header className={styles.header}><a className="wordmark" href="/">Soma<span aria-hidden="true">.</span></a><button className="text-button" onClick={() => setAuthMode('signin')}>Sign in</button></header>
    <main className={styles.main} id="entrance-main" tabIndex={-1}>
      {error && <div className="alert error" role="alert"><span>{error}</span><button className="text-button" onClick={retry}>Retry account check</button></div>}
      <section className={styles.hero} aria-labelledby="entrance-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Your coursework, in context</p>
          <h1 className={styles.title} id="entrance-title">Study what matters next.</h1>
          <p className={styles.lede}>Soma brings your course material, deadlines, available time, and learning progress together to prepare interactive lessons and practice.</p>
          <p className={styles.note}>As your classes and circumstances change, your preparation keeps up. Explore a concept, request a lesson, or pick up where you left off.</p>
          <div className={styles.actions}><button className="primary-button" onClick={() => setAuthMode('signup')}>Create account <ArrowRight size={17} aria-hidden="true"/></button><button className="secondary-button" onClick={openDemo}>Try quick demo</button></div>
          <p className={styles.note}>The quick demo uses original synthetic courses. No sign-in or connected accounts needed.</p>
        </div>
        <section className={styles.flow} aria-labelledby="entrance-flow-title">
          <h2 id="entrance-flow-title">From course context to your next useful step.</h2>
          <div className={styles.step}><span className={styles.icon}><Layers3 size={22} aria-hidden="true"/></span><div><h3>Start with your material</h3><p>Choose the course sources and commitments Soma can use. Keep the evidence behind each next step in view.</p></div></div>
          <div className={styles.step}><span className={styles.icon}><BookOpen size={22} aria-hidden="true"/></span><div><h3>Have practice ready</h3><p>Open a prepared lesson, or ask for practice from a passage. See why it fits your course and your study window.</p></div></div>
          <div className={styles.step}><span className={styles.icon}><SlidersHorizontal size={22} aria-hidden="true"/></span><div><h3>Explore, then shape what follows</h3><p>Try interactive controls and optional questions. Saved responses and any help inform what Soma prepares next.</p></div></div>
        </section>
      </section>
      <section className={styles.context} aria-label="How Soma works">
        <div><h2>Course content meets real-life context.</h2><p>Materials show what you are learning. Deadlines, selected commitments, and your available time help decide what deserves attention now.</p></div>
        <div><h2>Powered by Meta’s Muse Spark.</h2><p>Spark investigates course updates and prepares source-grounded activities. Each result identifies its sources and preparation mode. Generated lessons remain labeled as previews until reviewed.</p></div>
      </section>
      <p className={styles.footer}>Hackathon beta · Sources are read only · Your private account and the synthetic demo are separate.</p>
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
