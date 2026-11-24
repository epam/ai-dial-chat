import { CELEBRATIONS_CLASS } from '../constants/public-class-names';
import type { CornerRect } from '../models/composer-corner';
import type {
  HistoryLadderGeometryOptions,
  HistoryLadderPlan,
} from '../models/history-ladder';
import type { Point } from '../models/lottie-composition';
import {
  HistoryLadderAnchor,
  HistoryLadderMode,
} from '../types/history-ladder';
import type { CelebrationSnapshotTarget } from './celebration-snapshots';
import {
  cornerRectsIntersect,
  getVisibleViewport,
  measureCornerTargets,
} from './composer-corner-geometry';
import type { SceneTargetBaseline } from './scene-targets';

const STATIONS = Object.values(HistoryLadderAnchor);
const MAX_CONTAINERS = 4;
const MAX_SCENE_LAYERS = 4;
const MAX_LINKS = 120;
const MAX_ANCESTORS = 24;
const MAX_ROW_NODES = 80;
const MAX_CONTROLS = 16;
const MAX_CONTROL_SEARCH_NODES = 128;
const MAX_COPY_PATH_CHECKS = 24;
const DRAWN_GAP = 12;
const HIDDEN_SUBTREE = '[hidden], [inert], [data-celebration-snapshot]';
const EXCLUDED = `${HIDDEN_SUBTREE}, [aria-hidden="true"]`;
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const UNAVAILABLE = ':disabled, [aria-disabled="true"], [aria-expanded="true"]';
const INTERACTIVE =
  'button, a[href], area[href], summary, details, label, iframe, embed, object, img[usemap], [tabindex], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="listbox"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="slider"], [role="spinbutton"], [role="tab"], [role="textbox"], [role="treeitem"], audio[controls], video[controls]';
const CONTROLS = 'h1, h2, [role="heading"], button, input, textarea, select';
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

const isUntransformed = (value: string) => value === '' || value === 'none';

/* A virtual list translates a wrapper, not the copied row. Its viewport rect
   already includes that offset; only non-translational transforms need mapping. */
const isTranslationMatrix = (value: string): boolean => {
  if (isUntransformed(value)) return true;
  const match = /^(matrix|matrix3d)\(([^)]+)\)$/.exec(value);
  if (!match) return false;
  const parts = match[2].split(',');
  if (parts.some((part) => part.trim() === '')) return false;
  const values = parts.map(Number);
  if (!values.every(Number.isFinite)) return false;
  if (match[1] === 'matrix')
    return (
      values.length === 6 &&
      values[0] === 1 &&
      values[1] === 0 &&
      values[2] === 0 &&
      values[3] === 1
    );
  return (
    values.length === 16 &&
    values.every(
      (value, index) =>
        index === 12 || index === 13 || value === (index % 5 === 0 ? 1 : 0),
    )
  );
};

const isPlanarTranslate = (value: string): boolean => {
  if (isUntransformed(value)) return true;
  const parts = value.trim().split(/\s+/);
  return (
    parts.length >= 1 &&
    parts.length <= 3 &&
    parts.every((part, index) => {
      const match =
        /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|%)?$/i.exec(part);
      if (!match || !Number.isFinite(Number(match[1]))) return false;
      const amount = Number(match[1]);
      return index === 2
        ? amount === 0
        : amount === 0 || match[2] !== undefined;
    })
  );
};

const hasUnsupportedTransform = (
  style: CSSStyleDeclaration,
  isRowItself: boolean,
): boolean => {
  const transform = style.getPropertyValue('transform');
  const translate = style.getPropertyValue('translate');
  return (
    ['rotate', 'scale', 'perspective'].some(
      (name) => !isUntransformed(style.getPropertyValue(name)),
    ) ||
    !['', 'normal', '1'].includes(style.getPropertyValue('zoom')) ||
    (isRowItself
      ? !isUntransformed(transform) || !isUntransformed(translate)
      : !isTranslationMatrix(transform) || !isPlanarTranslate(translate))
  );
};

const rectangle = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): CornerRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});

const isFiniteRect = (rect: CornerRect | DOMRectReadOnly): boolean =>
  [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(
    Number.isFinite,
  ) &&
  rect.width > 0 &&
  rect.height > 0 &&
  Math.abs(rect.right - rect.left - rect.width) < 0.000001 &&
  Math.abs(rect.bottom - rect.top - rect.height) < 0.000001;

const contains = (outer: CornerRect, inner: CornerRect): boolean =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.right <= outer.right &&
  inner.bottom <= outer.bottom;

const union = (first: CornerRect, second: CornerRect): CornerRect =>
  rectangle(
    Math.min(first.left, second.left),
    Math.min(first.top, second.top),
    Math.max(first.right, second.right),
    Math.max(first.bottom, second.bottom),
  );

const stationRectangle = (
  { references, bounds }: HistoryLadderGeometryOptions,
  name: string,
  point: Point,
  side: 1 | -1,
): CornerRect => {
  const ref = references[name];
  const bound = bounds[name];
  const from = point.x + side * (bound.left - ref.x);
  const to = point.x + side * (bound.right - ref.x);
  return rectangle(
    Math.min(from, to),
    point.y + bound.top - ref.y,
    Math.max(from, to),
    point.y + bound.bottom - ref.y,
  );
};

/* Native curves may move between stations; protect the whole connecting band,
   rather than just checking the poses at either end. */
const routeRectangles = (
  options: HistoryLadderGeometryOptions,
  points: Readonly<Record<string, Point>>,
  side: 1 | -1,
): CornerRect[] => {
  const stations = STATIONS.map((name) =>
    stationRectangle(options, name, points[name], side),
  );
  return [
    ...stations,
    ...stations.slice(1).map((rect, index) => union(stations[index], rect)),
  ];
};

/**
 * Resolves six fixed stations and, at most, one source row. All layout reads
 * happen here; the returned membership check compares identities only.
 */
export const resolveHistoryLadderGeometry = (
  options: HistoryLadderGeometryOptions,
): HistoryLadderPlan | null => {
  const { anchors, direction, references, bounds, maxGap, maxDrift } = options;
  if (
    !Number.isFinite(maxGap) ||
    maxGap <= 0 ||
    !Number.isFinite(maxDrift) ||
    maxDrift < 0 ||
    (options.drawnBounds !== undefined && !isFiniteRect(options.drawnBounds)) ||
    !STATIONS.some((name) => name === options.copyAnchor) ||
    STATIONS.some(
      (name, index) =>
        !references[name] ||
        ![references[name].x, references[name].y].every(Number.isFinite) ||
        !bounds[name] ||
        !isFiniteRect(bounds[name]) ||
        (index > 0 && references[name].y <= references[STATIONS[index - 1]].y),
    )
  )
    return null;

  const viewport = getVisibleViewport();
  const semantic = measureCornerTargets(anchors);
  if (!viewport || !semantic) return null;
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const side = direction === 'rtl' ? -1 : 1;
  const protectedRects: CornerRect[] = semantic.protectedTargets.map(
    ({ rect }) => rect,
  );
  const watched = new Map<Element, SceneTargetBaseline>(
    semantic.watched.map((target) => [target.element, target]),
  );
  const rects = new Map<Element, DOMRect>();
  const styles = new Map<Element, CSSStyleDeclaration>();
  const animated = new Map<Element, boolean>();
  const measure = (element: Element) => {
    let rect = rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      rects.set(element, rect);
    }
    return rect;
  };
  const styleOf = (element: Element) => {
    let style = styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const isAnimating = (element: Element) => {
    if (!animated.has(element))
      animated.set(
        element,
        element
          .getAnimations?.()
          .some(
            ({ playState, pending }) => playState === 'running' || pending,
          ) ?? false,
      );
    return animated.get(element);
  };
  const watch = (element: Element) => {
    if (!watched.has(element))
      watched.set(element, { element, rect: measure(element) });
  };
  /* The viewport-mapped scene must not inherit an offset already included in
     source getBoundingClientRect values. A custom portal may share an ancestor. */
  const sceneLayers = document.getElementsByClassName(
    CELEBRATIONS_CLASS.sceneLayer,
  );
  if (sceneLayers.length > MAX_SCENE_LAYERS) return null;
  const sceneAncestors = new Set<Element>([
    document.body,
    document.documentElement,
  ]);
  for (const layer of Array.from(sceneLayers)) {
    let ancestor: Element | null = layer;
    for (let depth = 0; ancestor && depth < MAX_ANCESTORS; depth++) {
      sceneAncestors.add(ancestor);
      ancestor = ancestor.parentElement;
    }
    if (ancestor) return null;
    watch(layer);
  }
  if (
    [...sceneAncestors].some((element) =>
      hasUnsupportedTransform(styleOf(element), true),
    )
  )
    return null;
  const visible = (
    element: HTMLElement,
    isRow: boolean,
  ): CelebrationSnapshotTarget | undefined => {
    const rect = measure(element);
    if (!isFiniteRect(rect)) return undefined;
    if (isRow && !contains(viewport, rect)) return undefined;
    let clipped = rectangle(rect.left, rect.top, rect.right, rect.bottom);
    let ancestor: HTMLElement | null = element;
    for (let depth = 0; ancestor && depth < MAX_ANCESTORS; depth++) {
      const style = styleOf(ancestor);
      if (
        ancestor.matches(EXCLUDED) ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden' ||
        (isRow &&
          (hasUnsupportedTransform(style, ancestor === element) ||
            (ancestor !== element && isAnimating(ancestor))))
      )
        return undefined;
      if (ancestor !== element) {
        const clipX = CLIPPING.test(style.overflowX || style.overflow);
        const clipY = CLIPPING.test(style.overflowY || style.overflow);
        if (clipX || clipY) {
          const clip = measure(ancestor);
          clipped = rectangle(
            clipX ? Math.max(clipped.left, clip.left) : clipped.left,
            clipY ? Math.max(clipped.top, clip.top) : clipped.top,
            clipX ? Math.min(clipped.right, clip.right) : clipped.right,
            clipY ? Math.min(clipped.bottom, clip.bottom) : clipped.bottom,
          );
        }
      }
      ancestor = ancestor.parentElement;
    }
    if (ancestor || clipped.width <= 0 || clipped.height <= 0) return undefined;
    if (isRow && !contains(clipped, rect)) return undefined;
    return { element, rect };
  };
  const isIdleRow = (row: HTMLElement): boolean => {
    if (
      row.contains(document.activeElement) ||
      row.matches(':hover') ||
      row.matches(EXCLUDED)
    )
      return false;
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_ELEMENT);
    const ariaHidden = new Set<Element>();
    let node: Node | null = row;
    let count = 0;
    while (node) {
      if (++count > MAX_ROW_NODES) return false;
      const element = node as Element;
      if (element.matches(`${EDITABLE}, ${UNAVAILABLE}, ${HIDDEN_SUBTREE}`))
        return false;
      /* Decorative dots and SVG icons are commonly aria-hidden. They do not
         hide the row; controls hidden from accessibility still make it unsafe. */
      if (
        element.getAttribute('aria-hidden') === 'true' ||
        (element.parentElement && ariaHidden.has(element.parentElement))
      ) {
        ariaHidden.add(element);
        if (element.matches(INTERACTIVE)) return false;
      }
      node = walker.nextNode();
    }
    return !row
      .getAnimations?.({ subtree: true })
      .some(({ playState, pending }) => playState === 'running' || pending);
  };
  const isSafeRect = (rect: CornerRect) =>
    contains(viewport, rect) &&
    !protectedRects.some((obstacle) => cornerRectsIntersect(rect, obstacle));
  const drawnRectangle = (points: Readonly<Record<string, Point>>) => {
    const bounds = options.drawnBounds;
    if (!bounds) return undefined;
    const origin = references[HistoryLadderAnchor.Row0];
    const point = points[HistoryLadderAnchor.Row0];
    const x = point.x - side * origin.x;
    const y = point.y - origin.y;
    return rectangle(
      x + Math.min(side * bounds.left, side * bounds.right),
      y + bounds.top,
      x + Math.max(side * bounds.left, side * bounds.right),
      y + bounds.bottom,
    );
  };
  const isSafe = (
    points: Readonly<Record<string, Point>>,
    hasDrawnCards = false,
  ) => {
    const rectangles = routeRectangles(options, points, side);
    const drawn = hasDrawnCards && drawnRectangle(points);
    if (drawn) rectangles.push(drawn);
    return rectangles.every(isSafeRect);
  };

  const containers = anchors.historyContainer
    ? document.getElementsByClassName(anchors.historyContainer)
    : undefined;
  const initialContainerCount = containers?.length ?? 0;
  if (initialContainerCount > MAX_CONTAINERS) return null;
  const initialContainers = Array.from(containers ?? []).slice(
    0,
    MAX_CONTAINERS,
  );
  const hasTargetSetChanged = () =>
    semantic.hasTargetSetChanged() ||
    (containers?.length ?? 0) !== initialContainerCount ||
    initialContainers.some((element, index) => containers?.[index] !== element);
  const plan = (
    mode: HistoryLadderMode,
    points: Readonly<Record<string, Point>>,
    copy?: CelebrationSnapshotTarget,
  ): HistoryLadderPlan => ({
    mode,
    points,
    side,
    copy,
    watched: [...watched.values()],
    hasTargetSetChanged,
    width,
    height,
  });

  try {
    const histories: CelebrationSnapshotTarget[][] = [];
    let linkCount = 0;
    let controlCount = 0;
    let isHistoryOverBudget = false;
    for (const container of initialContainers) {
      if (!(container instanceof HTMLElement)) continue;
      watch(container);
      /* Reject row subtrees during control discovery: a long list must not
         turn this bounded header scan into a walk through every row. */
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) =>
            (node as Element).tagName.toLowerCase() === 'li'
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT,
        },
      );
      let searched = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (++searched > MAX_CONTROL_SEARCH_NODES) return null;
        if (!(node instanceof HTMLElement) || !node.matches(CONTROLS)) continue;
        if (++controlCount > MAX_CONTROLS) return null;
        watch(node);
        const control = visible(node, false);
        if (control) protectedRects.push(control.rect);
      }
      if (!anchors.historyRowLink || isHistoryOverBudget) continue;
      const links = container.querySelectorAll(anchors.historyRowLink);
      linkCount += links.length;
      if (linkCount > MAX_LINKS) {
        isHistoryOverBudget = true;
        histories.length = 0;
        continue;
      }
      const found = new Set<HTMLElement>();
      const rows: CelebrationSnapshotTarget[] = [];
      for (const link of links) {
        const row = link.closest('li');
        if (!row || !container.contains(row) || found.has(row)) continue;
        found.add(row);
        if (!isIdleRow(row)) continue;
        const target = visible(row, true);
        if (target && target.rect.width >= 40 && target.rect.height >= 12)
          rows.push(target);
      }
      rows.sort((first, second) => first.rect.top - second.rect.top);
      histories.push(rows);
    }
    let copyPathChecks = 0;
    const copyStation = STATIONS.findIndex(
      (name) => name === options.copyAnchor,
    );
    historySearch: for (const candidates of histories) {
      if (candidates.length < STATIONS.length) continue;
      /* Cache at most six envelopes per discovered row. Candidate corridors
         reuse these values and never measure the host again. */
      const stationRows = STATIONS.map((name) =>
        candidates.map(({ rect }) => {
          const atLeft = options.useStartEdge ? side === 1 : side !== 1;
          const point = { x: atLeft ? rect.left : rect.right, y: rect.top };
          const envelope = stationRectangle(options, name, point, side);
          return { point, envelope, isSafe: isSafeRect(envelope) };
        }),
      );
      /* Prefer the lowest usable ending row, then the widest reachable
         corridor. A tall list or an unsafe trailing row need not discard a
         shorter valid descent. Keep both endpoints of the chosen corridor. */
      for (let end = candidates.length - 1; end >= STATIONS.length - 1; end--) {
        if (!stationRows[STATIONS.length - 1][end].isSafe) continue;
        for (let start = 0; start <= end - STATIONS.length + 1; start++) {
          if (
            !stationRows[0][start].isSafe ||
            candidates[end].rect.top - candidates[start].rect.top >
              maxGap * (STATIONS.length - 1)
          )
            continue;
          const indices = STATIONS.map(
            (_, index) =>
              start +
              Math.round((index * (end - start)) / (STATIONS.length - 1)),
          );
          const stations = indices.map((row, index) => stationRows[index][row]);
          if (
            !stations.every(({ isSafe }) => isSafe) ||
            !stations.slice(1).every((station, index) => {
              const previous = stations[index];
              return (
                candidates[indices[index + 1]].rect.top >=
                  candidates[indices[index]].rect.bottom &&
                station.point.y - previous.point.y <= maxGap &&
                Math.abs(station.point.x - previous.point.x) <= maxDrift &&
                isSafeRect(union(previous.envelope, station.envelope))
              );
            })
          )
            continue;
          const copy = candidates[indices[copyStation]];
          if (copy.rect.width > 320 || copy.rect.height > 64) continue;
          const points = Object.fromEntries(
            stations.map(({ point }, index) => [STATIONS[index], point]),
          );
          if (options.isCopyPathSafe || options.isRouteSafe) {
            /* Only geometrically valid corridors pay for native track binding.
               Exhaustion keeps the complete drawn alternative available. */
            if (copyPathChecks >= MAX_COPY_PATH_CHECKS) break historySearch;
            copyPathChecks++;
            if (
              options.isRouteSafe &&
              !options.isRouteSafe(
                points,
                side,
                viewport,
                protectedRects,
                HistoryLadderMode.History,
              )
            )
              continue;
            if (
              options.isCopyPathSafe &&
              !options.isCopyPathSafe(
                copy,
                points,
                side,
                viewport,
                protectedRects,
              )
            )
              continue;
          }
          for (const index of indices) {
            const { element, rect } = candidates[index];
            watched.set(element, { element, rect });
          }
          return plan(HistoryLadderMode.History, points, copy);
        }
      }
    }
  } catch {
    /* Malformed host selectors or unavailable history leave the native
       alternative available; no source has been changed or copied. */
  }

  const canonical = Object.fromEntries(
    STATIONS.map((name) => [
      name,
      { x: side * references[name].x, y: references[name].y },
    ]),
  );
  const canonicalBounds = routeRectangles(options, canonical, side);
  const drawn = drawnRectangle(canonical);
  if (drawn) canonicalBounds.push(drawn);
  const extent = canonicalBounds.reduce(union);
  for (const composer of semantic.composers) {
    if (composer.isClipped || !contains(viewport, composer.rect)) continue;
    const { rect } = composer;
    const end = side === 1 ? rect.right - extent.width : rect.left;
    const start = side === 1 ? rect.left : rect.right - extent.width;
    const clampX = (left: number) =>
      Math.min(viewport.right - extent.width, Math.max(viewport.left, left));
    const right = rect.right + DRAWN_GAP;
    const left = rect.left - DRAWN_GAP - extent.width;
    const nearCorners = [...new Set([clampX(end), clampX(start)])];
    /* The nearest space above a phone composer can contain its heading.
       Try the space just above that obstacle before moving below the input. */
    const aboveObstacles = protectedRects
      .filter((obstacle) => obstacle.top < rect.top)
      .sort((first, second) => second.top - first.top)
      .flatMap((obstacle) =>
        nearCorners
          .filter(
            (left) =>
              left < obstacle.right && left + extent.width > obstacle.left,
          )
          .map((left) => [left, obstacle.top - DRAWN_GAP - extent.height]),
      );
    const candidates = [
      [clampX(end), rect.top - DRAWN_GAP - extent.height],
      [clampX(start), rect.top - DRAWN_GAP - extent.height],
      [side === 1 ? right : left, rect.bottom - extent.height],
      [side === 1 ? left : right, rect.bottom - extent.height],
      ...aboveObstacles,
      [side === 1 ? right : left, viewport.bottom - extent.height],
      [side === 1 ? left : right, viewport.bottom - extent.height],
      [clampX(end), rect.bottom + DRAWN_GAP],
      [clampX(start), rect.bottom + DRAWN_GAP],
    ];
    for (const [left, top] of candidates) {
      const points = Object.fromEntries(
        STATIONS.map((name) => [
          name,
          {
            x: canonical[name].x + left - extent.left,
            y: canonical[name].y + top - extent.top,
          },
        ]),
      );
      if (
        isSafe(points, true) &&
        (!options.isRouteSafe ||
          options.isRouteSafe(
            points,
            side,
            viewport,
            protectedRects,
            HistoryLadderMode.Drawn,
          ))
      )
        return plan(HistoryLadderMode.Drawn, points);
    }
  }
  return null;
};
