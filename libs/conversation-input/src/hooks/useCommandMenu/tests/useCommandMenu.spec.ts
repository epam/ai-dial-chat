import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CommandMenuConfig } from '../../../models/Input';
import { useCommandMenu } from '../useCommandMenu';

const config: CommandMenuConfig = {
  triggerPrefix: '/',
} as CommandMenuConfig;

describe('useCommandMenu', () => {
  it('reopens on backspacing to the bare trigger after dismissal', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: '' } },
    );

    act(() => result.current.handleValueChange('/', 1, false));
    rerender({ message: '/' });
    expect(result.current.isMenuOpen).toBe(true);

    act(() => result.current.handleValueChange('/sdf', 4, false));
    rerender({ message: '/sdf' });

    act(() => result.current.dismiss());
    expect(result.current.isMenuOpen).toBe(false);

    act(() => result.current.handleValueChange('/sd', 3, false));
    rerender({ message: '/sd' });
    act(() => result.current.handleValueChange('/s', 2, false));
    rerender({ message: '/s' });
    act(() => result.current.handleValueChange('/', 1, false));
    rerender({ message: '/' });

    expect(result.current.isMenuOpen).toBe(true);
  });

  it('does not reopen while a query still follows the trigger', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: '' } },
    );

    act(() => result.current.handleValueChange('/', 1, false));
    rerender({ message: '/' });
    act(() => result.current.handleValueChange('/sdf', 4, false));
    rerender({ message: '/sdf' });
    act(() => result.current.dismiss());

    act(() => result.current.handleValueChange('/sd', 3, false));
    rerender({ message: '/sd' });

    expect(result.current.isMenuOpen).toBe(false);
  });

  it('still reopens when the textarea is cleared to empty and the trigger is retyped', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: '' } },
    );

    act(() => result.current.handleValueChange('/', 1, false));
    rerender({ message: '/' });
    act(() => result.current.handleValueChange('/sdf', 4, false));
    rerender({ message: '/sdf' });
    act(() => result.current.dismiss());

    act(() => result.current.handleValueChange('', 0, false));
    rerender({ message: '' });
    expect(result.current.isMenuOpen).toBe(false);

    act(() => result.current.handleValueChange('/', 1, false));
    rerender({ message: '/' });

    expect(result.current.isMenuOpen).toBe(true);
  });

  it('opens on a trigger typed after other text', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: 'text text ' } },
    );

    act(() => result.current.handleValueChange('text text /', 11, false));
    rerender({ message: 'text text /' });

    expect(result.current.isMenuOpen).toBe(true);
  });

  it('opens on a trigger typed between two existing words', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: 'text  text' } },
    );

    act(() => result.current.handleValueChange('text / text', 6, false));
    rerender({ message: 'text / text' });

    expect(result.current.isMenuOpen).toBe(true);
    expect(result.current.activeWordStart).toBe(5);
  });

  it('reopens after backspacing a word with trailing text down to the bare trigger', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: '' } },
    );

    act(() => result.current.handleValueChange('/ab ', 3, false));
    rerender({ message: '/ab ' });
    act(() => result.current.handleValueChange('/a ', 2, false));
    rerender({ message: '/a ' });
    act(() => result.current.handleValueChange('/ ', 1, false));
    rerender({ message: '/ ' });

    expect(result.current.isMenuOpen).toBe(true);
    expect(result.current.activeWordStart).toBe(0);
  });

  it('closes once the trigger word gains internal whitespace', () => {
    const { result, rerender } = renderHook(
      ({ message }) => useCommandMenu({ config, message }),
      { initialProps: { message: '/ab' } },
    );

    act(() => result.current.handleValueChange('/ab', 3, false));
    rerender({ message: '/ab' });
    expect(result.current.isMenuOpen).toBe(true);

    act(() => result.current.handleValueChange('/ab text', 8, false));
    rerender({ message: '/ab text' });

    expect(result.current.isMenuOpen).toBe(false);
  });
});
