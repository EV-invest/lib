import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../src/react/index.js';
import type { ErrorSink } from '../src/index.js';

function Boom(): ReactNode {
  throw new Error('kaboom');
}

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

function mount(node: ReactNode): void {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

describe('ErrorBoundary', () => {
  it('reports to the sink with { componentStack }, calls onError, renders fallback', () => {
    const reportError = vi.fn();
    const sink: ErrorSink = { reportError };
    const onError = vi.fn();

    // React logs caught errors to console.error; silence it for a clean run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary
        sink={sink}
        onError={onError}
        fallback={<div>fallback ui</div>}
      >
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(container.textContent).toContain('fallback ui');

    expect(reportError).toHaveBeenCalledTimes(1);
    const [err, ctx] = reportError.mock.calls[0]!;
    expect((err as Error).message).toBe('kaboom');
    expect(ctx).toHaveProperty('componentStack');

    expect(onError).toHaveBeenCalledTimes(1);
    const [oErr] = onError.mock.calls[0]!;
    expect((oErr as Error).message).toBe('kaboom');
  });

  it('renders children when nothing throws', () => {
    mount(
      <ErrorBoundary fallback={<div>fallback ui</div>}>
        <div>healthy</div>
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('healthy');
    expect(container.textContent).not.toContain('fallback ui');
  });

  it('supports a render-prop fallback receiving the error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary fallback={(error) => <div>{error.message}</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    expect(container.textContent).toContain('kaboom');
  });
});
