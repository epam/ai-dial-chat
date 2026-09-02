/* TODO: remove in next release */
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IsolatedModelViewProvider,
  useIsolatedModelView,
} from '../IsolatedModelViewContext';

const contextMocks = vi.hoisted(() => ({
  search: '' as string,
  items: [] as { id: string; reference?: string }[],
  isLoading: false,
  applyIsolatedViewOverride: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ search: contextMocks.search }),
}));

vi.mock('../DeploymentsContext', () => ({
  useDeployments: () => ({
    items: contextMocks.items,
    isLoading: contextMocks.isLoading,
  }),
}));

vi.mock('../UiFeaturesContext', () => ({
  useUiFeatures: () => ({
    applyIsolatedViewOverride: contextMocks.applyIsolatedViewOverride,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <IsolatedModelViewProvider>{children}</IsolatedModelViewProvider>
);

describe('IsolatedModelViewContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextMocks.search = '';
    contextMocks.items = [];
    contextMocks.isLoading = false;
  });

  it('is inactive when the query param is absent', () => {
    contextMocks.search = '';
    const { result } = renderHook(() => useIsolatedModelView(), { wrapper });

    expect(result.current).toEqual({
      isActive: false,
      isNotFound: false,
      resolvedDeploymentId: null,
    });
    expect(contextMocks.applyIsolatedViewOverride).not.toHaveBeenCalled();
  });

  it('applies the forced feature set immediately, before deployments finish loading', () => {
    contextMocks.search = '?isolated-model-id=gpt-4';
    contextMocks.items = [];
    contextMocks.isLoading = true;
    const { result } = renderHook(() => useIsolatedModelView(), { wrapper });

    expect(result.current).toEqual({
      isActive: true,
      isNotFound: false,
      resolvedDeploymentId: null,
    });
    expect(contextMocks.applyIsolatedViewOverride).toHaveBeenCalledOnce();
    expect(contextMocks.applyIsolatedViewOverride).toHaveBeenCalledWith(
      new Set([
        OverlayFeature.DisallowChangeAgent,
        OverlayFeature.HideChangeAgent,
        OverlayFeature.HideEmptyChatChangeAgent,
        OverlayFeature.HideNewConversation,
        OverlayFeature.HideNavigationMenu,
      ]),
    );
  });

  it('resolves the deployment once deployments finish loading', () => {
    contextMocks.search = '?isolated-model-id=gpt-4';
    contextMocks.items = [{ id: 'gpt-4' }];
    contextMocks.isLoading = false;
    const { result } = renderHook(() => useIsolatedModelView(), { wrapper });

    expect(result.current).toEqual({
      isActive: true,
      isNotFound: false,
      resolvedDeploymentId: 'gpt-4',
    });
  });

  it('reports not-found once deployments have finished loading with no match, but still applies the override', () => {
    contextMocks.search = '?isolated-model-id=unknown-model';
    contextMocks.items = [{ id: 'gpt-4' }];
    contextMocks.isLoading = false;
    const { result } = renderHook(() => useIsolatedModelView(), { wrapper });

    expect(result.current).toEqual({
      isActive: true,
      isNotFound: true,
      resolvedDeploymentId: null,
    });
    expect(contextMocks.applyIsolatedViewOverride).toHaveBeenCalledOnce();
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useIsolatedModelView())).toThrow(
      'useIsolatedModelView must be used within an IsolatedModelViewProvider',
    );
  });
});
