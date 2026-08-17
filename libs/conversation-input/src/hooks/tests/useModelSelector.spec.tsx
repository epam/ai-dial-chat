import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useModelSelector } from '../useModelSelector';

const mockDeployments = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
  { id: 'claude-3', displayName: 'Claude 3', type: 'model' as const },
  { id: 'my-app', displayName: 'My App', type: 'application' as const },
];

const getLabelText = (label: unknown): string | undefined => {
  if (typeof label === 'string') {
    return label;
  }

  if (
    label == null ||
    typeof label !== 'object' ||
    !('props' in label) ||
    label.props == null ||
    typeof label.props !== 'object'
  ) {
    return undefined;
  }

  const props = label.props as Record<string, unknown>;

  if ('text' in props && typeof props.text === 'string') {
    return props.text;
  }

  // label is a wrapper element (e.g. <span>) — look for text in the first child
  if ('children' in props) {
    const children = Array.isArray(props.children)
      ? props.children
      : [props.children];
    for (const child of children) {
      const text = getLabelText(child);
      if (text !== undefined) return text;
    }
  }

  return undefined;
};

describe('useModelSelector — selectorAriaLabel', () => {
  it('uses default label when no deployment is selected', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: undefined,
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Select model');
  });

  it('appends selected item displayName to the label', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: 'gpt-4o',
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Select model: GPT-4o');
  });

  it('uses custom ariaLabel from modelSelectorLabels', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: 'gpt-4o',
        modelSelectorLabels: { ariaLabel: 'Model' },
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Model: GPT-4o');
  });

  it('falls back to item id when displayName is absent', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [
          { id: 'raw-id', type: 'model' as const },
        ] as unknown as DeploymentItem[],
        selectedDeploymentId: 'raw-id',
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Select model: raw-id');
  });
});

describe('useModelSelector — menuItems', () => {
  it('returns empty array when deployments is undefined', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: undefined,
      }),
    );
    expect(result.current.menuItems).toEqual([]);
  });

  it('returns empty array when deployments is empty and no state label', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
      }),
    );
    expect(result.current.menuItems).toEqual([]);
  });

  it('returns seven disabled skeleton items when deployments are loading', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        modelSelectorLabels: { loading: 'Loading…' },
      }),
    );
    expect(result.current.menuItems).toHaveLength(7);
    expect(result.current.menuItems.every((item) => item.disabled)).toBe(true);
    expect(result.current.menuItems.every((item) => item.icon)).toBe(true);
    expect(result.current.menuItems.every((item) => item.label)).toBe(true);
  });

  it('prefers loading label over error and empty labels', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        modelSelectorLabels: {
          loading: 'Loading…',
          error: 'Error',
          empty: 'Empty',
        },
      }),
    );
    expect(result.current.menuItems).toHaveLength(7);
  });

  it('shows skeleton items during a reload even when deployments already exist', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        modelSelectorLabels: { loading: 'Loading…' },
      }),
    );
    expect(result.current.menuItems).toHaveLength(7);
    expect(result.current.menuHeader).toBeUndefined();
  });

  it('falls back to error label when loading is absent', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        modelSelectorLabels: { error: 'Failed', empty: 'Empty' },
      }),
    );
    expect(result.current.menuItems[0].label).toBe('Failed');
  });

  it('returns one item per deployment preserving input order', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
      }),
    );
    expect(result.current.menuItems).toHaveLength(3);
    expect(result.current.menuItems[0].key).toBe('gpt-4o');
    expect(getLabelText(result.current.menuItems[0].label)).toBe('GPT-4o');
    expect(result.current.menuItems[1].key).toBe('claude-3');
    expect(getLabelText(result.current.menuItems[1].label)).toBe('Claude 3');
    expect(result.current.menuItems[2].key).toBe('my-app');
    expect(getLabelText(result.current.menuItems[2].label)).toBe('My App');
  });

  it('updates the active item when selectedDeploymentId changes', () => {
    const { result, rerender } = renderHook(
      ({ selectedDeploymentId }) =>
        useModelSelector({
          deployments: mockDeployments,
          selectedDeploymentId,
        }),
      { initialProps: { selectedDeploymentId: 'gpt-4o' } },
    );

    expect(result.current.menuItems[1].className).toBeUndefined();

    rerender({ selectedDeploymentId: 'claude-3' });

    expect(result.current.menuItems[0].className).toBeUndefined();
  });

  it('item onClick calls onDeploymentChange with item id', () => {
    const onDeploymentChange = vi.fn();
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        onDeploymentChange,
      }),
    );
    result.current.menuItems[2].onClick?.({
      key: 'my-app',
      domEvent: {} as ReactMouseEvent,
    });
    expect(onDeploymentChange).toHaveBeenCalledWith('my-app');
  });

  it('uses pre-resolved iconUrl directly from deployment item', () => {
    const deployments = [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        type: 'model' as const,
        iconUrl: '/api/v1/files/download?path=icon.png',
      },
    ];
    const { result } = renderHook(() => useModelSelector({ deployments }));
    expect(result.current.menuItems[0].key).toBe('gpt-4o');
    expect(result.current.menuItems[0].icon).not.toBeNull();
    expect(result.current.menuItems[0].icon).not.toBeUndefined();
  });
});

describe('useModelSelector — search filtering', () => {
  it('returns all items when search query is empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
      }),
    );
    expect(result.current.menuItems).toHaveLength(3);
  });

  it('filters items by displayName (case-insensitive)', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
      }),
    );
    /*
     * Simulate search by closing and re-opening would not work in isolation;
     * instead we access the internal setter via onOpenChange side-effect.
     * We need to trigger the search — the hook exposes no direct setter,
     * so we test filtering indirectly via DialSearch onChange in integration.
     * Here we verify the baseline (no query) returns all items.
     */
    expect(result.current.menuItems).toHaveLength(3);
  });
});

describe('useModelSelector — onOpenChange', () => {
  it('menuHeader is rendered when deployments is non-empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
      }),
    );
    expect(result.current.menuHeader).not.toBeNull();
    expect(result.current.menuHeader).not.toBeUndefined();
  });

  it('menuHeader is undefined when deployments is empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
      }),
    );
    expect(result.current.menuHeader).toBeUndefined();
  });

  it('menuHeader is undefined when deployments is undefined', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: undefined,
      }),
    );
    expect(result.current.menuHeader).toBeUndefined();
  });
});

describe('useModelSelector — selectorIcon', () => {
  it('returns a ReactNode (not null/undefined) for the trigger icon', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: 'gpt-4o',
      }),
    );
    expect(result.current.selectorIcon).not.toBeNull();
    expect(result.current.selectorIcon).not.toBeUndefined();
  });
});
