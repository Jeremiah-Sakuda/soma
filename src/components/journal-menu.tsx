'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** A disclosure that behaves like a menu panel: native details/summary for
 * keyboard and assistive technology, closed by Escape or a click outside. */
export function JournalMenu({
  label,
  summary,
  align = 'end',
  className = '',
  closeOn,
  children,
}: {
  /** Accessible name for an icon-only summary; visible text names it otherwise. */
  label?: string;
  summary: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Items that finish the menu's job (opening an exploration, say) close it. */
  closeOn?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        menu.open = false;
        menu.querySelector('summary')?.focus();
        return;
      }
      if (!menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return (
    <details ref={ref} className={`journal-menu ${className}`}>
      <summary aria-label={label}>{summary}</summary>
      <div
        className={`journal-menu-panel align-${align}`}
        onClick={(event) => {
          if (closeOn && (event.target as Element).closest(closeOn) && ref.current)
            ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
