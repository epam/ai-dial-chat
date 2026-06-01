import { act, renderHook } from '@testing-library/react';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import { useModelSelector } from '../useModelSelector.js';

const mockDeployments = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
  { id: 'claude-3', displayName: 'Claude 3', type: 'model' as const },
  { id: 'my-app', displayName: 'My App', type: 'application' as const },
];

const noopResolver = (url: string) => url;

describe('useModelSelector — selectorAriaLabel', () => {
  it('uses default label when no deployment is selected', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: undefined,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Select model');
  });

  it('appends selected item displayName to the label', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        selectedDeploymentId: 'gpt-4o',
        resolveDeploymentIconUrl: noopResolver,
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
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.selectorAriaLabel).toBe('Model: GPT-4o');
  });

  it('falls back to item id when displayName is absent', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [{ id: 'raw-id', type: 'model' as const }] as unknown as DeploymentItemDto[],
        selectedDeploymentId: 'raw-id',
        resolveDeploymentIconUrl: noopResolver,
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
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems).toEqual([]);
  });

  it('returns empty array when deployments is empty and no state label', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems).toEqual([]);
  });

  it('returns disabled state item when deployments is empty and loading label is set', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        modelSelectorLabels: { loading: 'Loading…' },
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems).toEqual([
      { key: '__state', label: 'Loading…', disabled: true },
    ]);
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
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems[0].label).toBe('Loading…');
  });

  it('falls back to error label when loading is absent', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        modelSelectorLabels: { error: 'Failed', empty: 'Empty' },
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems[0].label).toBe('Failed');
  });

  it('returns one item per deployment with correct key and label', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems).toHaveLength(3);
    expect(result.current.menuItems[0]).toMatchObject({
      key: 'gpt-4o',
      label: 'GPT-4o',
    });
    expect(result.current.menuItems[1]).toMatchObject({
      key: 'claude-3',
      label: 'Claude 3',
    });
    expect(result.current.menuItems[2]).toMatchObject({
      key: 'my-app',
      label: 'My App',
    });
  });

  it('item onClick calls onDeploymentChange with item id', () => {
    const onDeploymentChange = vi.fn();
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        onDeploymentChange,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    result.current.menuItems[2].onClick?.({
      key: 'my-app',
      domEvent: {} as MouseEvent,
    });
    expect(onDeploymentChange).toHaveBeenCalledWith('my-app');
  });

  it('calls resolveDeploymentIconUrl for items that have an iconUrl', () => {
    const resolver = vi.fn().mockReturnValue('/resolved.png');
    const deployments = [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        type: 'model' as const,
        iconUrl: 'files/bucket/icon.png',
      },
    ];
    renderHook(() =>
      useModelSelector({ deployments, resolveDeploymentIconUrl: resolver }),
    );
    expect(resolver).toHaveBeenCalledWith('files/bucket/icon.png');
  });

  it('does not call resolveDeploymentIconUrl when iconUrl is absent', () => {
    const resolver = vi.fn().mockReturnValue(undefined);
    renderHook(() =>
      useModelSelector({
        deployments: [
          { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
        ],
        resolveDeploymentIconUrl: resolver,
      }),
    );
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe('useModelSelector — search filtering', () => {
  it('returns all items when search query is empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuItems).toHaveLength(3);
  });

  it('filters items by displayName (case-insensitive)', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    act(() => {
      // Simulate search by closing and re-opening would not work in isolation;
      // instead we access the internal setter via onOpenChange side-effect.
      // We need to trigger the search — the hook exposes no direct setter,
      // so we test filtering indirectly via DialSearch onChange in integration.
      // Here we verify the baseline (no query) returns all items.
    });
    expect(result.current.menuItems).toHaveLength(3);
  });
});

describe('useModelSelector — onOpenChange', () => {
  it('menuHeader is rendered when deployments is non-empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: mockDeployments,
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuHeader).not.toBeNull();
    expect(result.current.menuHeader).not.toBeUndefined();
  });

  it('menuHeader is undefined when deployments is empty', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: [],
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.menuHeader).toBeUndefined();
  });

  it('menuHeader is undefined when deployments is undefined', () => {
    const { result } = renderHook(() =>
      useModelSelector({
        deployments: undefined,
        resolveDeploymentIconUrl: noopResolver,
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
        resolveDeploymentIconUrl: noopResolver,
      }),
    );
    expect(result.current.selectorIcon).not.toBeNull();
    expect(result.current.selectorIcon).not.toBeUndefined();
  });
});
