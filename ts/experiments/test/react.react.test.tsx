import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExperimentTracker,
  useExperimentEvent,
  type CaptureFn,
} from '../src/react/index';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function ClickButton({ cta }: { cta: string }) {
  const track = useExperimentEvent();
  return (
    <button type="button" onClick={() => track('cta_clicked', { cta })}>
      go
    </button>
  );
}

describe('ExperimentTracker', () => {
  it('fires `${experiment}_exposed` once on mount through the injected onEvent sink', () => {
    const onEvent = vi.fn<CaptureFn>();
    act(() => {
      root.render(
        <ExperimentTracker experiment="hero" variant="b" onEvent={onEvent}>
          <span>content</span>
        </ExperimentTracker>,
      );
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('hero_exposed', { variant: 'b' });
  });
});

describe('useExperimentEvent', () => {
  it("track('cta_clicked', { cta }) emits `${exp}_cta_clicked` with the merged variant", () => {
    const onEvent = vi.fn<CaptureFn>();
    act(() => {
      root.render(
        <ExperimentTracker experiment="hero" variant="b" onEvent={onEvent}>
          <ClickButton cta="explore" />
        </ExperimentTracker>,
      );
    });
    onEvent.mockClear(); // drop the exposure call

    const button = container.querySelector('button')!;
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('hero_cta_clicked', {
      variant: 'b',
      cta: 'explore',
    });
  });

  it('throws when used outside <ExperimentTracker>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      act(() => {
        root.render(<ClickButton cta="x" />);
      });
    }).toThrow('useExperimentEvent must be used inside <ExperimentTracker>');
    spy.mockRestore();
  });
});

describe('no analytics coupling', () => {
  it('never imports @evinvest/analytics (or any analytics SDK) in src', () => {
    const root = resolve(process.cwd(), 'src');
    const files = [
      'index.ts',
      'react/index.tsx',
      'next/index.ts',
    ].map((f) => readFileSync(resolve(root, f), 'utf8'));
    // Match actual module specifiers (import/export-from/require), not prose in
    // doc comments — the CaptureFn TSDoc intentionally *mentions* the package.
    const importsAnalytics = /(?:import|export|require)\b[^;\n]*['"]@evinvest\/analytics/;
    const importsPosthog = /(?:import|export|require)\b[^;\n]*['"]posthog/;
    for (const source of files) {
      expect(source).not.toMatch(importsAnalytics);
      expect(source).not.toMatch(importsPosthog);
    }
  });
});
