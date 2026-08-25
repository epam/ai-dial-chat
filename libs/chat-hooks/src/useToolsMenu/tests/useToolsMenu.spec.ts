import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type UseToolsMenuParams, useToolsMenu } from '../useToolsMenu';

const LABELS = { deepResearchFallback: 'tools.deepResearchFallback' };

const makeParams = (
  overrides: Partial<UseToolsMenuParams>,
): UseToolsMenuParams => ({
  deepResearchToolId: 'deep_research',
  selectedItemId: 'deploy-1',
  selectedDeploymentConfiguration: {
    properties: { deep_research: { type: 'boolean', default: false } },
  },
  labels: LABELS,
  toolIcon: null,
  ...overrides,
});

const boolProp = { type: 'boolean', default: false };

describe('useToolsMenu', () => {
  it('returns empty toolsMenuItems when deepResearchToolId is null', () => {
    const { result } = renderHook(() =>
      useToolsMenu(makeParams({ deepResearchToolId: null })),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when selectedDeploymentConfiguration is null', () => {
    const { result } = renderHook(() =>
      useToolsMenu(makeParams({ selectedDeploymentConfiguration: null })),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when schema lacks the configured tool property', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: { other_tool: { type: 'boolean', default: false } },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when the matching property is not boolean-typed', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: {
              deep_research: { type: 'string', default: 'off' },
            },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
  });

  it('returns a single item when tool id matches a boolean property with explicit type', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    expect(result.current.toolsMenuItems).toHaveLength(1);
    expect(result.current.toolsMenuItems[0].id).toBe('deep_research');
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('infers boolean type when type is absent but default is boolean', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: { deep_research: { default: false } },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems).toHaveLength(1);
  });

  it('uses schema title as label when available', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: {
              deep_research: {
                type: 'boolean',
                default: false,
                title: 'Deep Research',
              },
            },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems[0].label).toBe('Deep Research');
  });

  it('falls back to the supplied fallback label when schema has no title', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    expect(result.current.toolsMenuItems[0].label).toBe(
      'tools.deepResearchFallback',
    );
  });

  it('falls back to the English default when no labels are supplied', () => {
    const { result } = renderHook(() =>
      useToolsMenu(makeParams({ labels: undefined })),
    );

    expect(result.current.toolsMenuItems[0].label).toBe('Deep research');
  });

  it('initialises isSelected from schema default when default is true', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: { deep_research: { type: 'boolean', default: true } },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: true,
    });
  });

  it('onToolToggle flips isSelected when called with the matching id', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);

    act(() => {
      result.current.onToolToggle('deep_research');
    });

    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: true,
    });
  });

  it('onToolToggle ignores unknown ids', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    act(() => {
      result.current.onToolToggle('unknown_id');
    });

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('resets toggle state when selectedItemId changes', () => {
    const initial = makeParams({
      selectedDeploymentConfiguration: {
        properties: { deep_research: boolProp },
      },
    });
    const { result, rerender } = renderHook(
      (props: UseToolsMenuParams) => useToolsMenu(props),
      { initialProps: initial },
    );

    act(() => {
      result.current.onToolToggle('deep_research');
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);

    rerender(makeParams({ selectedItemId: 'deploy-2' }));

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('returns stable toolsMenuItems reference when nothing changes', () => {
    const initial = makeParams({});
    const { result, rerender } = renderHook(
      (props: UseToolsMenuParams) => useToolsMenu(props),
      { initialProps: initial },
    );
    const first = result.current.toolsMenuItems;

    rerender(initial);

    expect(result.current.toolsMenuItems).toBe(first);
  });

  it('returns stable onToolToggle reference when nothing changes', () => {
    const initial = makeParams({});
    const { result, rerender } = renderHook(
      (props: UseToolsMenuParams) => useToolsMenu(props),
      { initialProps: initial },
    );
    const first = result.current.onToolToggle;

    rerender(initial);

    expect(result.current.onToolToggle).toBe(first);
  });

  it('restoreToolConfiguration sets isSelected from a persisted configuration value', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    act(() => {
      result.current.restoreToolConfiguration({ deep_research: true });
    });

    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: true,
    });
  });

  it('restoreToolConfiguration ignores a non-boolean or missing value', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    act(() => {
      result.current.restoreToolConfiguration({ other_tool: true });
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);

    act(() => {
      result.current.restoreToolConfiguration(undefined);
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('restoreToolConfiguration is a no-op when deepResearchToolId is null', () => {
    const { result } = renderHook(() =>
      useToolsMenu(makeParams({ deepResearchToolId: null })),
    );

    act(() => {
      result.current.restoreToolConfiguration({ deep_research: true });
    });

    expect(result.current.toolConfigurationValue).toEqual({});
  });
});
