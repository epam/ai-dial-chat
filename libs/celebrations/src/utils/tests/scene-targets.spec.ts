import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATIONS_CLASS } from '../../constants/public-class-names';
import { observeSceneTargets } from '../scene-targets';

describe('scene target observation', () => {
  let source: HTMLElement;
  let parent: HTMLElement;
  let layer: HTMLElement;
  let rect: DOMRect;
  let notifyResize: () => void;
  let dispose: (() => void) | undefined;
  const onChange = vi.fn();
  const disconnect = vi.fn();
  const observe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rect = new DOMRect(20, 40, 100, 60);
    parent = document.createElement('main');
    source = document.createElement('button');
    source.textContent = 'Original';
    parent.append(source);
    layer = document.createElement('div');
    layer.className = CELEBRATIONS_CLASS.sceneLayer;
    document.body.append(parent, layer);
    vi.spyOn(source, 'getBoundingClientRect').mockImplementation(() => rect);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
  });
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    parent.remove();
    layer.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const start = () => {
    dispose = observeSceneTargets([source], onChange);
  };

  it.each(['class', 'style', 'hidden', 'inert', 'aria-hidden', 'dir'])(
    'cancels when an ancestor changes %s',
    async (attribute) => {
      start();
      parent.setAttribute(
        attribute,
        attribute === 'style' ? 'display:none' : 'changed',
      );
      await Promise.resolve();
      expect(onChange).toHaveBeenCalledOnce();
      expect(disconnect).toHaveBeenCalledOnce();
    },
  );

  it('cancels when target content changes or disappears', async () => {
    start();
    source.textContent = 'Recycled';
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledOnce();
    source.remove();
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('cancels when a source is removed with its ancestor', async () => {
    start();
    parent.remove();
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('ignores the initial resize notification but cancels a real resize', () => {
    start();
    notifyResize();
    expect(onChange).not.toHaveBeenCalled();
    rect = new DOMRect(20, 40, 130, 60);
    notifyResize();
    expect(onChange).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('detects a position shift after sibling insertion', async () => {
    start();
    rect = new DOMRect(20, 90, 100, 60);
    parent.prepend(document.createElement('p'));
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('keeps playing when a fixed toast disappears without moving the target', async () => {
    const toast = document.createElement('aside');
    document.body.append(toast);
    start();
    toast.remove();
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores scene-owned mutations without remeasuring targets', async () => {
    start();
    const reads = vi.mocked(source.getBoundingClientRect).mock.calls.length;
    layer.append(document.createElement('span'));
    layer.style.opacity = '0';
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    expect(source.getBoundingClientRect).toHaveBeenCalledTimes(reads);
  });

  it('releases observers once and does no work after disposal', async () => {
    start();
    dispose?.();
    dispose?.();
    vi.mocked(source.getBoundingClientRect).mockClear();
    source.remove();
    notifyResize();
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    expect(source.getBoundingClientRect).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('keeps mutation cancellation when ResizeObserver is unavailable', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    start();
    source.style.display = 'none';
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('allocates no observers when there are no targets', () => {
    dispose = observeSceneTargets([], onChange);
    dispose();
    expect(observe).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
