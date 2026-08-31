import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type UseToolsMenuParams, useToolsMenu } from '../useToolsMenu';

const makeParams = (
  overrides: Partial<UseToolsMenuParams>,
): UseToolsMenuParams => ({
  selectedItemId: 'deploy-1',
  selectedDeploymentConfiguration: {
    properties: { deep_research: { type: 'boolean', default: false } },
  },
  toolIcon: null,
  ...overrides,
});

const boolProp = { type: 'boolean', default: false };

describe('useToolsMenu', () => {
  it('returns empty toolsMenuItems when selectedDeploymentConfiguration is null', () => {
    const { result } = renderHook(() =>
      useToolsMenu(makeParams({ selectedDeploymentConfiguration: null })),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when the schema has no properties', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({ selectedDeploymentConfiguration: { type: 'object' } }),
      ),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('skips properties that are not boolean-typed', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: {
              deep_research: { type: 'string', default: 'off' },
              temperature: { type: 'number', default: 1 },
            },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems).toHaveLength(0);
  });

  it('returns one item per boolean property, in schema order', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: {
              deep_research: { type: 'boolean', default: false },
              system_prompt: { type: 'string' },
              web_search: { type: 'boolean', default: false },
            },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems.map((item) => item.id)).toEqual([
      'deep_research',
      'web_search',
    ]);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: false,
      web_search: false,
    });
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

  it('humanizes the property key when the schema has no title', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: { deep_research: boolProp, 'web-search': boolProp },
          },
        }),
      ),
    );

    expect(result.current.toolsMenuItems.map((item) => item.label)).toEqual([
      'Deep research',
      'Web search',
    ]);
  });

  it('initialises isSelected from the schema default when default is true', () => {
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

  it('onToolToggle flips only the tool it is called with', () => {
    const { result } = renderHook(() =>
      useToolsMenu(
        makeParams({
          selectedDeploymentConfiguration: {
            properties: { deep_research: boolProp, web_search: boolProp },
          },
        }),
      ),
    );

    act(() => {
      result.current.onToolToggle('deep_research');
    });

    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: true,
      web_search: false,
    });
  });

  it('onToolToggle ignores unknown ids', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    act(() => {
      result.current.onToolToggle('unknown_id');
    });

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: false,
    });
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

  it('restoreToolConfiguration ignores unknown ids, non-boolean and missing values', () => {
    const { result } = renderHook(() => useToolsMenu(makeParams({})));

    act(() => {
      result.current.restoreToolConfiguration({
        other_tool: true,
        deep_research: 'yes',
      });
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: false,
    });

    act(() => {
      result.current.restoreToolConfiguration(undefined);
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });
});
