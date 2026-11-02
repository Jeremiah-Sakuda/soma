'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { type ExplorationSpec } from '@/lib/domain/exploration';
import { type ExplorationViewState } from './exploration-scene';
import { PreparedAudio } from '@/lib/client/prepared-audio';

export { explorationNarration, nextPlaybackState } from '@/lib/domain/exploration-view';
import { explorationNarration, nextPlaybackState } from '@/lib/domain/exploration-view';
import { spokenText } from '@/lib/domain/spoken-text';
export function ExplorationPlayback({
  artifactId,
  version,
  spec,
  state,
  playing,
  onPlaying,
  onAdvance,
  onQuestion,
  onProgress,
  disabled = false,
}: {
  artifactId: string;
  version: number;
  spec: ExplorationSpec;
  state: ExplorationViewState;
  playing: boolean;
  onPlaying: (value: boolean) => void;
  onAdvance: (state: ExplorationViewState) => void;
  onQuestion: () => void;
  onProgress: (progress: number | null, key: string) => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false),
    [error, setError] = useState(''),
    [preparing, setPreparing] = useState(false),
    [provider, setProvider] = useState<'gemini' | 'browser'>('gemini'),
    [rate, setRate] = useState(1);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const resume = useRef<{ key: string; seconds: number } | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  useEffect(() => {
    if (activeAudio.current) activeAudio.current.playbackRate = rate;
  }, [rate]);
  const callbacks = useRef({ onPlaying, onAdvance, onProgress });
  callbacks.current = { onPlaying, onAdvance, onProgress };
  const generation = useRef(0),
    buffer = useRef(new PreparedAudio());
  const narration = explorationNarration(spec, state);
  const playbackKey = JSON.stringify([artifactId, version, state]);
  useEffect(() => {
    setAvailable(
      'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
    );
  }, []);
  useEffect(() => {
    buffer.current.clear();
    resume.current = null;
    return () => buffer.current.clear();
  }, [artifactId, version]);
  // This lifetime survives automatic step advances, but never an interruption.
  useEffect(() => {
    const audioBuffer = buffer.current;
    return () => audioBuffer.cancel();
  }, [playing, disabled, provider, artifactId, version]);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  useEffect(() => {
    setWaitingSeconds(0);
    if (!playing || !preparing) return;
    const began = Date.now();
    const timer = setInterval(
      () => setWaitingSeconds(Math.floor((Date.now() - began) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [playing, preparing, narration]);
  useEffect(() => {
    if (!playing || disabled) return;
    const token = ++generation.current;
    let audio: HTMLAudioElement | undefined,
      url: string | undefined,
      frame = 0,
      ended = false;
    if (resume.current?.key !== playbackKey) resume.current = null;
    const current = () => token === generation.current;
    const finish = () => {
      if (!current()) return;
      ended = true;
      resume.current = null;
      callbacks.current.onProgress(1, playbackKey);
      const next = nextPlaybackState(spec, state);
      if (next) callbacks.current.onAdvance(next);
      else callbacks.current.onPlaying(false);
    };
    setError('');
    callbacks.current.onProgress(null, playbackKey);
    if (provider === 'browser') {
      setPreparing(false);
      // Notation is spoken as words, as in the Gemini voice.
      const utterance = new SpeechSynthesisUtterance(spokenText(narration));
      utterance.rate = rateRef.current;
      window.speechSynthesis.cancel();
      utterance.onend = finish;
      // Browser voices do not reliably expose audio timing. Keep the checked
      // snapshot visible rather than manufacture synchronized motion.
      callbacks.current.onProgress(1, playbackKey);
      utterance.onerror = () => {
        if (current()) {
          setError('Browser audio is unavailable. Captions and manual steps still work.');
          callbacks.current.onPlaying(false);
        }
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setPreparing(true);
      void (async () => {
        try {
          const prepare = (view: ExplorationViewState) =>
            buffer.current.get(JSON.stringify([artifactId, version, view]), async (signal) => {
              const response = await fetch('/api/explore/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artifactId, version, state: view }),
                signal,
                cache: 'no-store',
              });
              if (!response.ok)
                throw Error(
                  'Gemini voice is unavailable. Try again, use browser voice, or continue with captions.',
                );
              if (response.headers.get('content-type')?.split(';')[0] !== 'audio/wav')
                throw Error('The voice response was incomplete. Captions are still available.');
              const blob = await response.blob();
              if (blob.size < 46 || blob.size > 1_440_044)
                throw Error('The voice response was incomplete. Captions are still available.');
              return blob;
            });
          const blob = await prepare(state);
          if (!current()) return;
          url = URL.createObjectURL(blob);
          audio = new Audio(url);
          activeAudio.current = audio;
          audio.playbackRate = rateRef.current;
          const resumeAt = resume.current?.key === playbackKey ? resume.current.seconds : 0;
          if (resumeAt > 0) audio.currentTime = resumeAt;
          audio.onended = finish;
          audio.onerror = () => {
            if (current()) {
              setError(
                'This audio could not play. Try browser voice or continue with captions.',
              );
              callbacks.current.onPlaying(false);
            }
          };
          setPreparing(false);
          await audio.play();
          const tick = () => {
            if (!current() || !audio) return;
            callbacks.current.onProgress(
              Number.isFinite(audio.duration) && audio.duration > 0
                ? Math.min(1, audio.currentTime / audio.duration)
                : 0,
              playbackKey,
            );
            frame = requestAnimationFrame(tick);
          };
          if (current()) tick();
          // One step ahead only, after playback actually begins. Advancement
          // joins this same promise, even if synthesis is still in flight.
          const next = nextPlaybackState(spec, state);
          if (current() && next)
            void prepare(next).catch(() => {
              /* Surface on demand; never retry automatically. */
            });
        } catch (failure) {
          if (current()) {
            setPreparing(false);
            setError(
              failure instanceof DOMException && failure.name === 'NotAllowedError'
                ? 'Your browser blocked audio. Press Play explanation to try the prepared audio again.'
                : failure instanceof Error
                  ? failure.message
                  : 'Audio is unavailable. Captions are still available.',
            );
            callbacks.current.onPlaying(false);
          }
        }
      })();
    }
    return () => {
      generation.current++;
      cancelAnimationFrame(frame);
      callbacks.current.onProgress(null, playbackKey);
      if (audio) {
        if (
          !ended &&
          Number.isFinite(audio.currentTime) &&
          audio.currentTime > 0 &&
          (!Number.isFinite(audio.duration) || audio.currentTime < audio.duration - 0.05)
        )
          resume.current = { key: playbackKey, seconds: audio.currentTime };
        else if (resume.current?.key === playbackKey) resume.current = null;
        if (activeAudio.current === audio) activeAudio.current = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (url) URL.revokeObjectURL(url);
      if (provider === 'browser') window.speechSynthesis.cancel();
    };
  }, [playing, disabled, provider, narration, spec, state, artifactId, version, playbackKey]);
  return (
    <section className="exploration-playback" aria-label="Guided explanation">
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={
            disabled || spec.mode === 'clarify' || (provider === 'browser' && !available)
          }
          onClick={() => onPlaying(!playing)}
        >
          {playing ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          {playing ? 'Pause explanation' : 'Play explanation'}
        </button>
        <button
          type="button"
          className="text-button journal-icon-button"
          aria-label="Replay from start"
          title="Replay from start"
          disabled={disabled || spec.mode === 'clarify'}
          onClick={() => {
            resume.current = null;
            // A replay resets even when already paused on the first step.
            if (activeAudio.current) activeAudio.current.currentTime = 0;
            onPlaying(false);
            onAdvance({ ...state, step: 0, explanationStep: 0 });
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button type="button" className="text-button journal-labelled-icon" onClick={onQuestion}>
          <MessageCircleQuestion size={16} aria-hidden="true" />
          <span>Ask about this</span>
        </button>
        <span className="meta">Follow along, or pause to ask about anything.</span>
      </div>
      <details className="exploration-voice-settings">
        <summary className="journal-labelled-icon journal-summary-icon">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Playback settings
        </summary>
        <p className="meta">
          Muse Spark builds the explanation.{' '}
          {provider === 'gemini'
            ? 'Gemini reads it aloud; the next step prepares while you listen.'
            : 'Your browser reads it aloud.'}{' '}
          Captions always stay available.
        </p>
        <label className="exploration-playback-rate">
          Narration speed
          <select
            value={rate}
            disabled={disabled}
            onChange={(event) => {
              const nextRate = Number(event.target.value);
              if (![0.8, 1, 1.2, 1.5].includes(nextRate)) return;
              // WAV speed changes in place. Browser utterances cannot reliably do
              // that, so pause them explicitly rather than silently desynchronise.
              if (provider === 'browser') onPlaying(false);
              setRate(nextRate);
            }}
          >
            <option value={0.8}>0.8× · Slower</option>
            <option value={1}>1× · Normal</option>
            <option value={1.2}>1.2× · Faster</option>
            <option value={1.5}>1.5× · Fastest</option>
          </select>
        </label>
        <p className="meta">
          Pause and resume Gemini narration from the same point. Animation follows the actual
          audio position.
        </p>
        <div className="action-row">
          <button
            type="button"
            className="text-button"
            disabled={disabled || (provider === 'gemini' && !available)}
            onClick={() => {
              onPlaying(false);
              setPreparing(false);
              setError('');
              resume.current = null;
              setProvider(provider === 'gemini' ? 'browser' : 'gemini');
            }}
          >
            {provider === 'gemini' ? 'Use browser voice' : 'Use Gemini voice'}
          </button>
        </div>
      </details>
      {playing && preparing && (
        <p role="status" className="meta">
          Preparing Gemini audio…{' '}
          <span aria-hidden="true">{waitingSeconds > 0 ? `${waitingSeconds}s · ` : ''}</span>
          Read the caption now, or keep exploring.{' '}
          {waitingSeconds >= 8 &&
            'Voice is taking longer; you can pause or choose browser voice in Playback settings.'}
        </p>
      )}
      <p className="exploration-spoken-caption" aria-live={playing ? 'off' : 'polite'}>
        {narration}
      </p>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
