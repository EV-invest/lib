/**
 * React tests for `usePhoneNumber` — requires jsdom.
 */
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhoneNumber } from '../src/react/index';
import { PhoneNumber } from '../src/index';

function changeEvent(value: string): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { value },
    currentTarget: { value },
  } as React.ChangeEvent<HTMLInputElement>;
}

describe('usePhoneNumber', () => {
  it('returns empty state by default', () => {
    const { result } = renderHook(() => usePhoneNumber());
    expect(result.current.displayValue).toBe('');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isValid).toBe(false);
  });

  it('accepts an initial E.164 string and formats it', () => {
    const { result } = renderHook(() => usePhoneNumber({ initial: '+12345678901' }));
    expect(result.current.displayValue).toBe('+1 234 567 8901');
    expect(result.current.value).toBeDefined();
    expect(PhoneNumber.raw(result.current.value!)).toBe('+12345678901');
    expect(result.current.isValid).toBe(true);
  });

  it('accepts an initial PhoneNumber', () => {
    const pn = PhoneNumber.from('+442012345678');
    const { result } = renderHook(() => usePhoneNumber({ initial: pn }));
    expect(result.current.displayValue).toBe('+44 201 234 5678');
    expect(result.current.value).toBeDefined();
  });

  it('updates displayValue on keystrokes', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('+1 234'));
    });
    expect(result.current.displayValue).toBe('+1 234');
    // Partial input — not yet a valid phone number.
    expect(result.current.value).toBeUndefined();
  });

  it('produces a valid PhoneNumber once enough digits are typed', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('+12345678901'));
    });
    expect(result.current.isValid).toBe(true);
    expect(result.current.value).toBeDefined();
    expect(PhoneNumber.raw(result.current.value!)).toBe('+12345678901');
  });

  it('strips formatting characters and normalizes', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      // User pastes a loosely-formatted number.
      result.current.inputProps.onChange(changeEvent('+1 (234) 567-8901'));
    });
    expect(result.current.isValid).toBe(true);
    expect(result.current.value).toBeDefined();
    // The canonical form is the stripped-down E.164 string.
    expect(PhoneNumber.raw(result.current.value!)).toBe('+12345678901');
  });

  it('reports error for invalid input', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('not-a-number'));
    });
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.code).toBeDefined();
    expect(result.current.isValid).toBe(false);
  });

  it('sets aria-invalid on error', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('abc'));
    });
    expect(result.current.inputProps['aria-invalid']).toBe(true);
  });

  it('clears aria-invalid when valid', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('abc'));
    });
    expect(result.current.inputProps['aria-invalid']).toBe(true);
    act(() => {
      result.current.inputProps.onChange(changeEvent('+12345678901'));
    });
    expect(result.current.inputProps['aria-invalid']).toBeUndefined();
  });

  it('reformats on blur when valid', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('+12345678901'));
    });
    // Before blur — display is as typed.
    expect(result.current.displayValue).toBe('+12345678901');
    act(() => {
      result.current.inputProps.onBlur();
    });
    // After blur — reformatted.
    expect(result.current.displayValue).toBe('+1 234 567 8901');
  });

  it('does not reformat on blur when invalid', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.inputProps.onChange(changeEvent('+1'));
    });
    act(() => {
      result.current.inputProps.onBlur();
    });
    // Stays as-is — partial input is not reformatted.
    expect(result.current.displayValue).toBe('+1');
  });

  it('calls onValid when value becomes valid', () => {
    const calls: string[] = [];
    const { result } = renderHook(() =>
      usePhoneNumber({ onValid: (pn) => calls.push(PhoneNumber.raw(pn)) }),
    );
    act(() => {
      result.current.inputProps.onChange(changeEvent('+12345678901'));
    });
    expect(calls).toEqual(['+12345678901']);
  });

  it('reset clears the input', () => {
    const { result } = renderHook(() => usePhoneNumber({ initial: '+12345678901' }));
    expect(result.current.isValid).toBe(true);
    act(() => {
      result.current.reset();
    });
    expect(result.current.displayValue).toBe('');
    expect(result.current.isValid).toBe(false);
    expect(result.current.value).toBeUndefined();
  });

  it('reset sets a new value', () => {
    const { result } = renderHook(() => usePhoneNumber());
    act(() => {
      result.current.reset('+442012345678');
    });
    expect(result.current.isValid).toBe(true);
    expect(result.current.displayValue).toBe('+44 201 234 5678');
  });
});
