import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMcpAppHostContext } from '../useMcpAppHostContext';

const root = document.documentElement;

describe('useMcpAppHostContext style extensions', () => {
  afterEach(() => {
    root.style.removeProperty('--mcp-ext-button-radius');
    root.style.removeProperty('--mcp-ext-button-primary-gradient-start');
    root.style.removeProperty('--mcp-ext-button-primary-text');
  });

  it('sends set --mcp-ext-* variables under their wire names', () => {
    root.style.setProperty('--mcp-ext-button-radius', '9999px');
    root.style.setProperty(
      '--mcp-ext-button-primary-gradient-start',
      '#1d4ed8',
    );
    root.style.setProperty('--mcp-ext-button-primary-text', '#fcfcfc');

    const { result } = renderHook(() =>
      useMcpAppHostContext('inline', { theme: 'light', locale: 'en' }),
    );

    expect(result.current['styleExtensions']).toEqual({
      variables: {
        '--button-radius': '9999px',
        '--button-primary-gradient-start': '#1d4ed8',
        '--button-primary-text': '#fcfcfc',
      },
    });
  });

  it('omits variables that are not set', () => {
    const { result } = renderHook(() =>
      useMcpAppHostContext('inline', { theme: 'light', locale: 'en' }),
    );

    expect(result.current['styleExtensions']).toEqual({ variables: {} });
  });
});
