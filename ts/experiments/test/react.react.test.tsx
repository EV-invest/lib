import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DevAbPanel,
  ExperimentTracker,
  match,
  readCookie,
  useExperimentEvent,
  writeVariant,
  type CaptureFn,
} from '../src/react/index';
import { cookieName, type ExperimentConfig } from '../src/index';

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

  it('routes the fire through the handler so it controls ordering', () => {
    const onEvent = vi.fn<CaptureFn>();
    const order: string[] = [];

    function OrderedButton() {
      const track = useExperimentEvent();
      return (
        <button
          type="button"
          onClick={() =>
            track('cta_clicked', { cta: 'explore' }, (fire) => {
              order.push('before');
              fire();
              order.push('after');
            })
          }
        >
          go
        </button>
      );
    }

    act(() => {
      root.render(
        <ExperimentTracker experiment="hero" variant="b" onEvent={onEvent}>
          <OrderedButton />
        </ExperimentTracker>,
      );
    });
    onEvent.mockClear();

    const button = container.querySelector('button')!;
    onEvent.mockImplementation(() => order.push('fired'));
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The handler decided when fire() ran: between "before" and "after".
    expect(order).toEqual(['before', 'fired', 'after']);
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

describe('match', () => {
  it('renders the branch for the active variant', () => {
    act(() => {
      root.render(
        <>{match<'a' | 'b'>('b', { a: <span>A</span>, b: <span>B</span> })}</>,
      );
    });
    expect(container.textContent).toBe('B');
  });

  it('renders a different branch when the variant changes', () => {
    act(() => {
      root.render(
        <>{match<'a' | 'b'>('a', { a: <span>A</span>, b: <span>B</span> })}</>,
      );
    });
    expect(container.textContent).toBe('A');
  });
});

describe('readCookie / writeVariant', () => {
  afterEach(() => {
    // Clear any cookie the test set.
    for (const c of document.cookie.split('; ')) {
      const name = c.split('=')[0];
      if (name) document.cookie = `${name}=;max-age=0;path=/`;
    }
  });

  it('writes the ab_<key> cookie and reads it back', () => {
    writeVariant('hero', 'b');
    expect(document.cookie).toContain(`${cookieName('hero')}=b`);
    expect(readCookie(cookieName('hero'))).toBe('b');
  });

  it('returns undefined for a cookie that is not set', () => {
    expect(readCookie('ab_absent')).toBeUndefined();
  });
});

describe('DevAbPanel', () => {
  const config = {
    hero: { variants: ['a', 'b'], weights: [1, 1] },
    team: { variants: ['x', 'y', 'z'], weights: [1, 1, 1] },
  } as const satisfies ExperimentConfig;

  const prevEnv = process.env['NODE_ENV'];
  beforeEach(() => {
    process.env['NODE_ENV'] = 'development';
  });
  afterEach(() => {
    process.env['NODE_ENV'] = prevEnv;
  });

  it('renders a button per experiment × variant and calls onSelect on click', () => {
    const onSelect = vi.fn<(key: string, variant: string) => void>();
    act(() => {
      root.render(<DevAbPanel config={config} onSelect={onSelect} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    // 2 hero variants + 3 team variants.
    expect(buttons).toHaveLength(5);

    const heroB = buttons.find((b) => b.textContent === 'b')!;
    act(() => {
      heroB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('hero', 'b');
  });

  it('calls onRefresh once after mount', () => {
    const onRefresh = vi.fn();
    act(() => {
      root.render(
        <DevAbPanel config={config} onSelect={() => {}} onRefresh={onRefresh} />,
      );
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('applies an extra className when provided', () => {
    act(() => {
      root.render(
        <DevAbPanel config={config} onSelect={() => {}} className="my-panel" />,
      );
    });
    expect(container.querySelector('.my-panel')).not.toBeNull();
  });

  it('renders nothing outside development', () => {
    process.env['NODE_ENV'] = 'production';
    act(() => {
      root.render(<DevAbPanel config={config} onSelect={() => {}} />);
    });
    expect(container.querySelector('button')).toBeNull();
  });

  it('imports no next/navigation router (prop-driven)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src', 'react', 'index.tsx'),
      'utf8',
    );
    // Strip block comments first: the DevAbPanel TSDoc @example intentionally
    // *shows* a `next/navigation` import as illustrative prose.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(
      /(?:import|export|require)\b[^;\n]*['"]next\/navigation/,
    );
  });
});

describe('no analytics coupling', () => {
  it('never imports @evinvest/analytics (or any analytics SDK) in src', () => {
    const root = resolve(process.cwd(), 'src');
    const files = ['index.ts', 'react/index.tsx', 'next/index.ts'].map((f) =>
      readFileSync(resolve(root, f), 'utf8'),
    );
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
