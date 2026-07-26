/**
 * React tests for `useEmail` — requires jsdom.
 */
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmail } from '../src/react/index';
import { Email } from '../src/index';

function changeEvent(value: string): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { value },
    currentTarget: { value },
  } as React.ChangeEvent<HTMLInputElement>;
}

describe('useEmail', () => {
  it('returns empty state by default', () => {
    const { result } = renderHook(() => useEmail());
    expect(result.current.displayValue).toBe('');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isValid).toBe(false);
  });

  it('accepts an initial string', () => {
    const { result } = renderHook(() =>
      useEmail({ initial: 'user@example.com' }),
    );
    expect(result.current.displayValue).toBe('user@example.com');
    expect(result.current.value).toBeDefined();
    expect(Email.raw(result.current.value!)).toBe('user@example.com');
    expect(result.current.isValid).toBe(true);
  });

  it('accepts an initial Email object', () => {
    const e = Email.from('User@Example.COM');
    const { result } = renderHook(() => useEmail({ initial: e }));
    expect(result.current.displayValue).toBe('user@example.com');
    expect(result.current.value).toBeDefined();
  });

  it('updates displayValue on keystrokes', () => {
    const { result } = renderHook(() => useEmail());
    act(() => result.current.inputProps.onChange(changeEvent('u')));
    expect(result.current.displayValue).toBe('u');
    // Partial input — not yet valid.
    expect(result.current.value).toBeUndefined();
    expect(result.current.isValid).toBe(false);
  });

  it('produces a valid Email when a complete address is typed', () => {
    const { result } = renderHook(() => useEmail());
    act(() =>
      result.current.inputProps.onChange(changeEvent('user@example.com')),
    );
    expect(result.current.value).toBeDefined();
    expect(Email.raw(result.current.value!)).toBe('user@example.com');
    expect(result.current.isValid).toBe(true);
  });

  it('reports error for invalid input', () => {
    const { result } = renderHook(() => useEmail());
    act(() =>
      result.current.inputProps.onChange(changeEvent('notanemail')),
    );
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.code).toBe('no_at');
    expect(result.current.value).toBeUndefined();
  });

  it('sets aria-invalid when input is invalid', () => {
    const { result } = renderHook(() => useEmail());
    act(() =>
      result.current.inputProps.onChange(changeEvent('bad')),
    );
    expect(result.current.inputProps['aria-invalid']).toBe(true);
  });

  it('trims and lowercases on blur when valid', () => {
    const { result } = renderHook(() => useEmail());
    act(() =>
      result.current.inputProps.onChange(
        changeEvent('  User@Example.COM  '),
      ),
    );
    // Before blur — display is raw input.
    expect(result.current.displayValue).toBe('  User@Example.COM  ');
    act(() => result.current.inputProps.onBlur());
    // After blur — trimmed and lowercased.
    expect(result.current.displayValue).toBe('user@example.com');
  });

  it('does not transform on blur when invalid', () => {
    const { result } = renderHook(() => useEmail());
    act(() =>
      result.current.inputProps.onChange(changeEvent('notfinished@')),
    );
    const beforeBlur = result.current.displayValue;
    act(() => result.current.inputProps.onBlur());
    expect(result.current.displayValue).toBe(beforeBlur);
  });

  it('calls onValid when a valid email is parsed', () => {
    let captured: string | undefined;
    const { result } = renderHook(() =>
      useEmail({ onValid: (e) => (captured = Email.raw(e)) }),
    );
    act(() =>
      result.current.inputProps.onChange(changeEvent('user@example.com')),
    );
    expect(captured).toBe('user@example.com');
  });

  it('reset() clears the input', () => {
    const { result } = renderHook(() =>
      useEmail({ initial: 'user@example.com' }),
    );
    expect(result.current.isValid).toBe(true);
    act(() => result.current.reset());
    expect(result.current.displayValue).toBe('');
    expect(result.current.value).toBeUndefined();
    expect(result.current.isValid).toBe(false);
  });

  it('reset() sets a new value', () => {
    const { result } = renderHook(() => useEmail());
    act(() => result.current.reset('new@example.com'));
    expect(result.current.displayValue).toBe('new@example.com');
    expect(result.current.value).toBeDefined();
    expect(Email.raw(result.current.value!)).toBe('new@example.com');
  });

  it('handles initial empty string', () => {
    const { result } = renderHook(() => useEmail({ initial: '' }));
    expect(result.current.displayValue).toBe('');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBeNull();
  });
});
