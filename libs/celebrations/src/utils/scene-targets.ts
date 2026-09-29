import { CELEBRATIONS_CLASS } from '../constants/public-class-names';

const GEOMETRY_TOLERANCE = 0.5;

/** Observe selected scene anchors without polling layout during playback. */
export const observeSceneTargets = (
  targets: readonly Element[],
  onChange: () => void,
  ownedRoots: readonly Element[] = [],
): (() => void) => {
  if (!targets.length) return () => undefined;
  const anchors = [...new Set(targets)].map((element) => ({
    element,
    rect: element.getBoundingClientRect(),
  }));
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    resize?.disconnect();
  };
  const cancel = () => {
    if (disposed) return;
    dispose();
    onChange();
  };
  const checkGeometry = () => {
    if (disposed) return;
    if (
      anchors.some(({ element, rect }) => {
        if (!element.isConnected) return true;
        const current = element.getBoundingClientRect();
        return (['left', 'top', 'width', 'height'] as const).some(
          (axis) => Math.abs(current[axis] - rect[axis]) > GEOMETRY_TOLERANCE,
        );
      })
    )
      cancel();
  };
  const isOwned = (node: Node) =>
    ownedRoots.some((root) => root === node || root.contains(node)) ||
    (node instanceof Element &&
      !!node.closest(`.${CELEBRATIONS_CLASS.sceneLayer}`));
  const observer = new MutationObserver((records) => {
    if (disposed) return;
    const external = records.filter(
      (record) =>
        !isOwned(record.target) &&
        (record.type !== 'childList' ||
          ![...record.addedNodes, ...record.removedNodes].every(isOwned)),
    );
    if (
      anchors.some(
        ({ element }) =>
          !element.isConnected ||
          external.some(
            (record) =>
              element.contains(record.target) ||
              (record.type === 'attributes' && record.target.contains(element)),
          ),
      )
    ) {
      cancel();
      return;
    }
    /* Structural changes outside a target can move it; a fixed toast leaving
       the page must not cancel a scene whose anchors remain in place. */
    if (
      external.some(
        (record) =>
          record.type === 'childList' &&
          anchors.some(({ element }) => record.target.contains(element)),
      )
    )
      checkGeometry();
  });
  const resize =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(checkGeometry)
      : undefined;
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'class',
      'style',
      'dir',
      'hidden',
      'inert',
      'aria-hidden',
      'aria-expanded',
      'href',
    ],
  });
  anchors.forEach(({ element }) => resize?.observe(element));
  return dispose;
};
