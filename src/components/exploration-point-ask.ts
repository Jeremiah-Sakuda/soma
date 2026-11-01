'use client';
import { useEffect, useRef, useState } from 'react';
import { pointFocusSchema } from '@/lib/domain/point-context';
import type { ExplorationCapture } from './exploration-capture';
export type PointVoiceCommand = {
  id: string;
  action: 'start' | 'stop' | 'cancel';
  sequence: number;
};
type Session = {
  id: string;
  ended: boolean;
  submitted: boolean;
  source?: ExplorationCapture;
  text?: string;
};
const feedback = (id: string, state: string) =>
  window.dispatchEvent(new CustomEvent('soma:point-feedback', { detail: { id, state } }));
export function useExplorationPointAsk(options: {
  ready: boolean;
  interrupt: () => void;
  prepare: (file: File) => Promise<ExplorationCapture>;
  source: (capture: ExplorationCapture) => void;
  submit: (text: string, capture: ExplorationCapture) => Promise<boolean>;
  error: (message: string) => void;
  /** A question already typed in the composer; when present, pointing uses it instead of voice. */
  typed?: () => string;
}) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const active = useRef<Session | null>(null),
    sequence = useRef(0);
  const [command, setCommand] = useState<PointVoiceCommand | null>(null),
    [sessionId, setSessionId] = useState<string | null>(null),
    [status, setStatus] = useState('');
  function cancel(message = '', notify = true) {
    const previous = active.current;
    active.current = null;
    setSessionId(null);
    if (previous) {
      setCommand({ id: previous.id, action: 'cancel', sequence: ++sequence.current });
      if (notify) feedback(previous.id, 'cancelled');
    }
    setStatus(message);
  }
  async function maybeSubmit(s: Session) {
    if (active.current !== s || s.submitted || !s.ended || !s.text || !s.source) return;
    s.submitted = true;
    setStatus('Preparing your selected explanation…');
    feedback(s.id, 'generating');
    const ok = await callbacks.current.submit(s.text, s.source);
    if (active.current !== s) return;
    active.current = null;
    setSessionId(null);
    setCommand(null);
    setStatus(
      ok
        ? 'Your selected explanation is ready.'
        : 'Your previous visual is kept. Try again or type your question.',
    );
    feedback(s.id, ok ? 'ready' : 'error');
  }
  useEffect(() => {
    let mounted = true;
    function handle(event: Event) {
      const d = (event as CustomEvent).detail;
      if (!d || typeof d.id !== 'string' || !/^[a-f0-9-]{36}$/.test(d.id)) return;
      if (d.type === 'begin') {
        if (!callbacks.current.ready) {
          feedback(d.id, 'error');
          callbacks.current.error('Soma is still loading or live help is unavailable.');
          return;
        }
        if (active.current) feedback(active.current.id, 'cancelled');
        const typed = callbacks.current.typed?.().trim().slice(0, 1000) ?? '';
        callbacks.current.interrupt();
        active.current = { id: d.id, ended: false, submitted: false, ...(typed ? { text: typed } : {}) };
        setSessionId(d.id);
        if (typed) {
          setStatus('Point or circle, then release to ask your typed question.');
          return;
        }
        setStatus('Listening · circle or point, then release to ask.');
        setCommand({ id: d.id, action: 'start', sequence: ++sequence.current });
        return;
      }
      const s = active.current;
      if (!s || s.id !== d.id) return;
      if (d.type === 'end') {
        s.ended = true;
        if (!s.text) setCommand({ id: d.id, action: 'stop', sequence: ++sequence.current });
        setStatus('Preparing your question and selected region…');
        void maybeSubmit(s);
      } else if (d.type === 'cancel') {
        cancel(
          typeof d.message === 'string' ? d.message.slice(0, 200) : 'Point & ask cancelled.',
          false,
        );
        callbacks.current.interrupt();
      } else if (d.type === 'source') {
        const focus = pointFocusSchema.safeParse(d.focus);
        if (
          !focus.success ||
          typeof d.dataUrl !== 'string' ||
          d.dataUrl.length > 680000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.dataUrl) ||
          !Number.isFinite(Date.parse(d.capturedAt))
        ) {
          cancel('The pointing context was invalid.');
          return;
        }
        void (async () => {
          try {
            const bytes = Uint8Array.from(atob(d.dataUrl.split(',')[1]), (c) =>
              c.charCodeAt(0),
            );
            const source = await callbacks.current.prepare(
              new File([bytes], 'Pointed display.jpg', { type: 'image/jpeg' }),
            );
            if (!mounted || active.current !== s) return;
            s.source = {
              ...source,
              kind: 'capture',
              nativeId: s.id,
              nativeHighlight: d.canPointBack === true,
              capturedAt: d.capturedAt,
              focus: focus.data,
            };
            callbacks.current.source(s.source);
            await maybeSubmit(s);
          } catch {
            if (active.current === s) {
              cancel('The selected display could not be prepared.');
              callbacks.current.error(
                'Capture failed. Type a question or upload a screenshot.',
              );
            }
          }
        })();
      }
    }
    window.addEventListener('soma:point-ask', handle);
    return () => {
      mounted = false;
      window.removeEventListener('soma:point-ask', handle);
      const previous = active.current;
      active.current = null;
      if (previous) feedback(previous.id, 'cancelled');
    };
  }, []);
  function transcript(text: string, id?: string) {
    const s = active.current;
    if (!id || s?.id !== id) return false;
    s.text = text;
    setStatus('Question transcribed. Preparing the selected visual…');
    void maybeSubmit(s);
    return true;
  }
  function voiceError(id?: string) {
    if (id && active.current?.id === id) {
      const s = active.current;
      cancel('Microphone or transcription unavailable. Type your question instead.', false);
      feedback(s.id, 'error');
    }
  }
  function partial(text: string, id?: string) {
    if (id && active.current?.id === id) {
      setStatus('Hearing: ' + text);
      window.dispatchEvent(
        new CustomEvent('soma:point-feedback', {
          detail: { id, state: 'partial', text: text.slice(0, 240) },
        }),
      );
    }
  }
  function voicePhase(phase: string, id?: string) {
    if (id && active.current?.id === id && ['recording', 'transcribing'].includes(phase))
      feedback(id, phase);
  }
  return { command, sessionId, status, cancel, transcript, voiceError, voicePhase, partial };
}
