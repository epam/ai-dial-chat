import { act, renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPanelProvider } from '../../../context/ConversationPanelContext';
import { ROUTES } from '../../../types/routes';
import { useConversationPanelRouteState } from '../useConversationPanelRouteState';

interface HookProps {
  pathname: string;
  isMobile: boolean;
  isCanvasOpen: boolean;
  isOpenByDefault: boolean;
}

const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <ConversationPanelProvider>{children}</ConversationPanelProvider>
);

/* The callbacks are created once per render helper, not per render, so a test
   can assert on them across re-renders. */
const renderPanelState = (props?: Partial<HookProps>) => {
  const onCloseCanvas = vi.fn();
  const onCloseSourcesPanel = vi.fn();

  const view = renderHook(
    (hookProps: HookProps) =>
      useConversationPanelRouteState({
        ...hookProps,
        onCloseCanvas,
        onCloseSourcesPanel,
      }),
    {
      wrapper,
      initialProps: {
        pathname: ROUTES.Root,
        isMobile: false,
        isCanvasOpen: false,
        isOpenByDefault: true,
        ...props,
      },
    },
  );

  return { ...view, onCloseCanvas, onCloseSourcesPanel };
};

describe('useConversationPanelRouteState', () => {
  it('opens the panel on a conversation route when the default is on', () => {
    const { result } = renderPanelState();

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('closes the panel on a conversation route when the default is off', () => {
    const { result } = renderPanelState({ isOpenByDefault: false });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('keeps the panel open across chat switches once the user opened it', () => {
    const { result, rerender } = renderPanelState({ isOpenByDefault: false });

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(true);

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: false,
    });
    expect(result.current.isPanelOpen).toBe(true);

    rerender({
      pathname: `${ROUTES.Conversations}/second`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: false,
    });
    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the panel open when a new chat navigates back to the root route', () => {
    const { result, rerender } = renderPanelState({
      pathname: `${ROUTES.Conversations}/first`,
      isOpenByDefault: false,
    });

    act(() => result.current.togglePanel());

    rerender({
      pathname: ROUTES.Root,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: false,
    });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it('keeps the panel closed across navigation once the user closed it', () => {
    const { result, rerender } = renderPanelState({ isOpenByDefault: true });

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(false);

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: true,
    });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('closes the panel outside the conversation section and restores the choice on return', () => {
    const { result, rerender } = renderPanelState({ isOpenByDefault: false });

    act(() => result.current.togglePanel());

    rerender({
      pathname: ROUTES.Catalog,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: false,
    });
    expect(result.current.isPanelOpen).toBe(false);

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: false,
    });
    expect(result.current.isPanelOpen).toBe(true);
  });

  it('closes the panel and drops the preference on mobile', () => {
    const { result, rerender } = renderPanelState({ isOpenByDefault: true });

    act(() => result.current.togglePanel());
    expect(result.current.isPanelOpen).toBe(false);

    rerender({
      pathname: ROUTES.Root,
      isMobile: true,
      isCanvasOpen: false,
      isOpenByDefault: true,
    });
    expect(result.current.isPanelOpen).toBe(false);

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: true,
    });
    expect(result.current.isPanelOpen).toBe(true);
  });

  it('leaves the panel closed while the attachment canvas is open', () => {
    const { result, rerender } = renderPanelState({ isOpenByDefault: true });

    rerender({
      pathname: ROUTES.Root,
      isMobile: false,
      isCanvasOpen: true,
      isOpenByDefault: true,
    });
    expect(result.current.isPanelOpen).toBe(false);

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: true,
      isOpenByDefault: true,
    });
    expect(result.current.isPanelOpen).toBe(false);
  });

  it('leaves the panel closed when the canvas is already open on the first render', () => {
    const { result } = renderPanelState({
      isCanvasOpen: true,
      isOpenByDefault: true,
    });

    expect(result.current.isPanelOpen).toBe(false);
  });

  it('closes the panel and the sources panel when the canvas opens', () => {
    const { result, rerender, onCloseCanvas, onCloseSourcesPanel } =
      renderPanelState({ isOpenByDefault: true });

    expect(result.current.isPanelOpen).toBe(true);
    onCloseCanvas.mockClear();

    rerender({
      pathname: ROUTES.Root,
      isMobile: false,
      isCanvasOpen: true,
      isOpenByDefault: true,
    });

    expect(result.current.isPanelOpen).toBe(false);
    expect(onCloseSourcesPanel).toHaveBeenCalledOnce();
    /* The safety net reacts to the canvas opening, so it must not close it. */
    expect(onCloseCanvas).not.toHaveBeenCalled();
  });

  it('closes the canvas on every navigation', () => {
    const { rerender, onCloseCanvas } = renderPanelState();

    expect(onCloseCanvas).toHaveBeenCalledOnce();

    rerender({
      pathname: `${ROUTES.Conversations}/first`,
      isMobile: false,
      isCanvasOpen: false,
      isOpenByDefault: true,
    });

    expect(onCloseCanvas).toHaveBeenCalledTimes(2);
  });
});
