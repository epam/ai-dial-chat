/* TODO: remove in next release */
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IsolatedModelViewProvider,
  useIsolatedModelView,
} from '../IsolatedModelViewContext';

const contextMocks = vi.hoisted(() => ({
  items: [] as { id: string; reference?: string }[],
  isLoading: false,
  applyIsolatedViewOverride: vi.fn(),
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

const setUrl = (pathOrSearch: string) => {
  const url = pathOrSearch.startsWith('/') ? pathOrSearch : `/${pathOrSearch}`;
  window.history.pushState({}, '', url);
};

describe('IsolatedModelViewContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextMocks.items = [];
    contextMocks.isLoading = false;
    setUrl('');
  });

  afterEach(() => {
    setUrl('');
  });

  it('is inactive when the query param is absent', () => {
    const { result } = renderHook(() => useIsolatedModelView(), { wrapper });

    expect(result.current).toEqual({
      isActive: false,
      isNotFound: false,
      resolvedDeploymentId: null,
    });
    expect(contextMocks.applyIsolatedViewOverride).not.toHaveBeenCalled();
  });

  it('applies the forced feature set immediately, before deployments finish loading', () => {
    setUrl('?isolated-model-id=gpt-4');
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
    setUrl('?isolated-model-id=gpt-4');
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
    setUrl('?isolated-model-id=unknown-model');
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

  /*
   * Regression test: after the first message, the app navigates away from
   * `/?isolated-model-id=...` to `/conversations/<id>`, which carries no
   * such param. Isolated view must stay active for the rest of the tab's
   * lifetime rather than re-reading the (now-changed) URL and snapping every
   * hidden surface (navigation, announcement banner, etc.) back into view.
   */
  it('stays active after the URL changes away from the isolated-model-id param', () => {
    setUrl('?isolated-model-id=gpt-4');
    contextMocks.items = [{ id: 'gpt-4' }];
    contextMocks.isLoading = false;
    const { result, rerender } = renderHook(() => useIsolatedModelView(), {
      wrapper,
    });

    expect(result.current.isActive).toBe(true);

    setUrl('/conversations/some-id');
    rerender();

    expect(result.current.isActive).toBe(true);
    expect(result.current.resolvedDeploymentId).toBe('gpt-4');
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useIsolatedModelView())).toThrow(
      'useIsolatedModelView must be used within an IsolatedModelViewProvider',
    );
  });
});
