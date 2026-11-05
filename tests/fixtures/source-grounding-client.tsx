import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ExplorationSourceGrounding } from '../../src/components/exploration-source-grounding';

export type SourceGroundingFixtureProps = Parameters<typeof ExplorationSourceGrounding>[0] & {
  sourceKey: string;
};

declare global {
  interface Window {
    __groundingInitial: SourceGroundingFixtureProps;
    __setGroundingProps: (next: Partial<SourceGroundingFixtureProps>) => void;
  }
}

// A real React lifecycle around the production component, with only local synthetic
// props. No application API, companion bridge, media, or provider is connected.
function SourceGroundingFixture() {
  const [props, setProps] = useState(window.__groundingInitial);
  useEffect(() => {
    window.__setGroundingProps = (next) =>
      flushSync(() => setProps((current) => ({ ...current, ...next })));
  }, []);
  const { sourceKey, ...grounding } = props;
  return <ExplorationSourceGrounding key={sourceKey} {...grounding} />;
}

createRoot(document.getElementById('root')!).render(<SourceGroundingFixture />);
