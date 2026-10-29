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
          <p className={styles.eyebrow}>A question becomes something you can explore</p>
          <h1 className={styles.title} id="entrance-title">See it. Ask. Explore.</h1>
          <p className={styles.lede}>Share a screenshot, ask what you want to understand, and let Soma build a visual explanation you can change and explore.</p>
          <p className={styles.note}>Move through a graph, change a starting point, and ask about the object you selected. Computed search results and generated explanations stay clearly labeled.</p>
          <div className={styles.actions}><a className="primary-button" href="/explore">Start exploring <ArrowRight size={17} aria-hidden="true"/></a><button className="secondary-button" onClick={() => setAuthMode('signup')}>Create account</button><button className="text-button" onClick={openDemo}>Try quick demo</button></div>
          <p className={styles.note}>Explore without an account. The course-workspace demo remains available with original synthetic courses.</p>
        </div>
        <section className={styles.flow} aria-labelledby="entrance-flow-title">
          <h2 id="entrance-flow-title">From a screenshot to an interactive explanation.</h2>
          <div className={styles.step}><span className={styles.icon}><Layers3 size={22} aria-hidden="true"/></span><div><h3>Choose what Soma sees</h3><p>Upload an image or select a window. Only frames you explicitly send become context for your question.</p></div></div>
          <div className={styles.step}><span className={styles.icon}><BookOpen size={22} aria-hidden="true"/></span><div><h3>Watch the idea take shape</h3><p>Muse Spark reads the image and composes a visual scene. Supported graph-search results are independently calculated.</p></div></div>
          <div className={styles.step}><span className={styles.icon}><SlidersHorizontal size={22} aria-hidden="true"/></span><div><h3>Change it and follow your curiosity</h3><p>Select an object, change the experiment, or ask a follow-up. Save a version and return to the same controls later.</p></div></div>
        </section>
      </section>
      <section className={styles.context} aria-label="How Soma works">
        <div><h2>Your material, your starting point.</h2><p>No course connections are required to explore. Your existing Soma workspace, course sources and saved learning activities remain available when you sign in.</p></div>
        <div><h2>Powered by Meta’s Muse Spark.</h2><p>Spark interprets the selected context, uses a checked search tool, and designs the visual explanation. You can inspect its assumptions, source and actual tool activity. Generated prose can still be mistaken.</p></div>
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
