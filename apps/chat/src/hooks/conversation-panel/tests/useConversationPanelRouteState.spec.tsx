import { act, renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPanelProvider } from '../../../context/ConversationPanelContext';
import { ROUTES } from '../../../types/routes';
import { StorageKey } from '../../../types/storage-key';
import { useConversationPanelRouteState } from '../useConversationPanelRouteState';

interface HookProps {
  pathname: string;
  isMobile: boolean;
  isCanvasOpen: boolean;
  isOpenByDefault: boolean;
  isToggleEnabled: boolean;
}

const readStoredChoice = () =>
  localStorage.getItem(StorageKey.NavigationSidebarExpanded);

const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <ConversationPanelProvider>{children}</ConversationPanelProvider>
);

const DEFAULT_PROPS: HookProps = {
  pathname: ROUTES.Root,
  isMobile: false,
  isCanvasOpen: false,
  isOpenByDefault: true,
  isToggleEnabled: true,
};

/* The callbacks are created once per render helper, not per render, so a test
   can assert on them across re-renders. */
const renderSidebarState = (props?: Partial<HookProps>) => {
  const onCloseCanvas = vi.fn();
  const onCloseSourcesPanel = vi.fn();

  const view = renderHook(
    (hookProps: HookProps) =>
      useConversationPanelRouteState({
        ...hookProps,
        onCloseCanvas,
        onCloseSourcesPanel,
      }),
    { wrapper, initialProps: { ...DEFAULT_PROPS, ...props } },
  );

  return { ...view, onCloseCanvas, onCloseSourcesPanel };
};

describe('useConversationPanelRouteState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts expanded when the default is on', () => {
    const { result } = renderSidebarState();

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('starts collapsed when the default is off', () => {
    const { result } = renderSidebarState({ isOpenByDefault: false });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('stays expanded on every page, whatever the route', () => {
    const { result, rerender } = renderSidebarState();

    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.Catalog });
    expect(result.current.isPanelOpen).toBe(true);

    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.FileManager });
    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the user collapse across navigation and back', () => {
    const { result, rerender } = renderSidebarState();

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(false);

    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.FileManager });
    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.Root });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('keeps the sidebar expanded across chat switches once the user expanded it', () => {
    const { result, rerender } = renderSidebarState({ isOpenByDefault: false });

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(true);

    rerender({
      ...DEFAULT_PROPS,
      isOpenByDefault: false,
      pathname: `${ROUTES.Conversations}/first`,
    });
    rerender({
      ...DEFAULT_PROPS,
      isOpenByDefault: false,
      pathname: `${ROUTES.Conversations}/second`,
    });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('collapses on mobile, then restores the user choice on desktop', () => {
    const { result, rerender } = renderSidebarState({ isOpenByDefault: false });

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(true);

    rerender({ ...DEFAULT_PROPS, isOpenByDefault: false, isMobile: true });
    expect(result.current.isPanelOpen).toBe(false);

    rerender({ ...DEFAULT_PROPS, isOpenByDefault: false, isMobile: false });
    expect(result.current.isPanelOpen).toBe(true);
    expect(readStoredChoice()).toBe('true');
  });

  it('keeps the user collapse across a reload', () => {
    const { result: resultBeforeReload, unmount } = renderSidebarState();
    act(() => resultBeforeReload.current.togglePanel());
    unmount();

    const { result } = renderSidebarState();

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('keeps the user expand across a reload', () => {
    const { result: resultBeforeReload, unmount } = renderSidebarState({
      isOpenByDefault: false,
    });
    act(() => resultBeforeReload.current.togglePanel());
    unmount();

    const { result } = renderSidebarState({ isOpenByDefault: false });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('writes the stored choice only from the toggle', () => {
    const { rerender } = renderSidebarState();

    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.Catalog });
    rerender({ ...DEFAULT_PROPS, isCanvasOpen: true });
    rerender({ ...DEFAULT_PROPS, isMobile: true });
    rerender({ ...DEFAULT_PROPS, isOpenByDefault: false });

    expect(readStoredChoice()).toBeNull();
  });

  it('ignores a stored value that is not a boolean', () => {
    localStorage.setItem(StorageKey.NavigationSidebarExpanded, '"collapsed"');

    const { result } = renderSidebarState();

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('ignores the stored choice when the toggle is disabled', () => {
    localStorage.setItem(StorageKey.NavigationSidebarExpanded, 'false');

    const { result } = renderSidebarState({ isToggleEnabled: false });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the user collapse for the session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result, rerender } = renderSidebarState();

    act(() => result.current.togglePanel());
    rerender({ ...DEFAULT_PROPS, pathname: ROUTES.FileManager });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('keeps the sidebar expanded when the canvas opens, and closes only the sources panel', () => {
    const { result, rerender, onCloseCanvas, onCloseSourcesPanel } =
      renderSidebarState();
    expect(result.current.isPanelOpen).toBe(true);
    onCloseCanvas.mockClear();

    rerender({ ...DEFAULT_PROPS, isCanvasOpen: true });

    expect(result.current.isPanelOpen).toBe(true);
    expect(onCloseSourcesPanel).toHaveBeenCalledOnce();
    expect(onCloseCanvas).not.toHaveBeenCalled();
  });

  it('starts from the default when the canvas is already open on the first render', () => {
    const { result } = renderSidebarState({ isCanvasOpen: true });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the sidebar expanded when the canvas closes', () => {
    const { result, rerender } = renderSidebarState();

    rerender({ ...DEFAULT_PROPS, isCanvasOpen: true });
    rerender({ ...DEFAULT_PROPS, isCanvasOpen: false });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the user collapse while the canvas opens and closes', () => {
    const { result, rerender } = renderSidebarState();
    act(() => result.current.togglePanel());

    rerender({ ...DEFAULT_PROPS, isCanvasOpen: true });
    expect(result.current.isPanelOpen).toBe(false);

    rerender({ ...DEFAULT_PROPS, isCanvasOpen: false });
    expect(result.current.isPanelOpen).toBe(false);
  });

  it('leaves the canvas open when the user expands the sidebar', () => {
    const { result, rerender, onCloseCanvas } = renderSidebarState({
      isOpenByDefault: false,
    });
    rerender({ ...DEFAULT_PROPS, isOpenByDefault: false, isCanvasOpen: true });

    onCloseCanvas.mockClear();
    act(() => result.current.togglePanel());

    expect(result.current.isPanelOpen).toBe(true);
    expect(onCloseCanvas).not.toHaveBeenCalled();
  });

  it('closes the canvas on every navigation', () => {
    const { rerender, onCloseCanvas } = renderSidebarState();
    expect(onCloseCanvas).toHaveBeenCalledOnce();

    rerender({
      ...DEFAULT_PROPS,
      pathname: `${ROUTES.Conversations}/first`,
    });

    expect(onCloseCanvas).toHaveBeenCalledTimes(2);
  });
});
