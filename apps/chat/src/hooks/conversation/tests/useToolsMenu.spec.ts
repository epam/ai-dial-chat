import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useToolsMenu } from '../useToolsMenu';

const { stableT } = vi.hoisted(() => ({
  stableT: (key: string) => key,
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: vi.fn(),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockUseAppConfig = vi.mocked(useAppConfig);
const mockUseDeployments = vi.mocked(useDeployments);

const makeAppConfig = (deepResearchToolId: string | null = null) => ({
  config: { deepResearchToolId },
});

const makeDeployments = (
  selectedItemId: string | null = 'deploy-1',
  properties?: Record<string, unknown>,
) => ({
  selectedItemId,
  selectedDeploymentConfiguration: properties != null ? { properties } : null,
});

describe('useToolsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty toolsMenuItems when deepResearchToolId is null', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig(null) as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when selectedDeploymentConfiguration is null', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', undefined) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when schema lacks the configured tool property', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        other_tool: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(0);
    expect(result.current.toolConfigurationValue).toEqual({});
  });

  it('returns empty toolsMenuItems when the matching property is not boolean-typed', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'string', default: 'off' },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(0);
  });

  it('returns a single item when tool id matches a boolean property with explicit type', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(1);
    expect(result.current.toolsMenuItems[0].id).toBe('deep_research');
    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('infers boolean type when type is absent but default is boolean', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems).toHaveLength(1);
  });

  it('uses schema title as label when available', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: {
          type: 'boolean',
          default: false,
          title: 'Deep Research',
        },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems[0].label).toBe('Deep Research');
  });

  it('falls back to translation key label when schema has no title', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    /* The mock t() returns the key as-is */
    expect(result.current.toolsMenuItems[0].label).toBe(
      'tools.deepResearchFallback',
    );
  });

  it('initialises isSelected from schema default when default is true', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: true },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);
    expect(result.current.toolConfigurationValue).toEqual({
      deep_research: true,
    });
  });

  it('onToolToggle flips isSelected when called with the matching id', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

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
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result } = renderHook(() => useToolsMenu());

    act(() => {
      result.current.onToolToggle('unknown_id');
    });

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('resets toggle state when selectedItemId changes', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    const boolProp = { type: 'boolean', default: false };
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', { deep_research: boolProp }) as never,
    );

    const { result, rerender } = renderHook(() => useToolsMenu());

    act(() => {
      result.current.onToolToggle('deep_research');
    });
    expect(result.current.toolsMenuItems[0].isSelected).toBe(true);

    /* Simulate deployment change */
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-2', { deep_research: boolProp }) as never,
    );
    rerender();

    expect(result.current.toolsMenuItems[0].isSelected).toBe(false);
  });

  it('returns stable toolsMenuItems reference when nothing changes', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result, rerender } = renderHook(() => useToolsMenu());
    const first = result.current.toolsMenuItems;

    rerender();

    expect(result.current.toolsMenuItems).toBe(first);
  });

  it('returns stable onToolToggle reference when nothing changes', () => {
    mockUseAppConfig.mockReturnValue(makeAppConfig('deep_research') as never);
    mockUseDeployments.mockReturnValue(
      makeDeployments('deploy-1', {
        deep_research: { type: 'boolean', default: false },
      }) as never,
    );

    const { result, rerender } = renderHook(() => useToolsMenu());
    const first = result.current.onToolToggle;

    rerender();

    expect(result.current.onToolToggle).toBe(first);
  });
});
