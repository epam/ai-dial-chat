/* An element counts only when it has a box and sits outside an inert subtree,
 * so a closed mobile drawer or a `display: none` desktop control is skipped. */
/** Returns whether `element` is an `HTMLElement` with a box, outside an `inert` subtree and not `visibility: hidden`. */
export const isOnScreen = (element: Element): element is HTMLElement =>
  element instanceof HTMLElement &&
  element.getClientRects().length > 0 &&
  element.closest('[inert]') == null &&
  getComputedStyle(element).visibility !== 'hidden';

/** Returns the first element of `elements` that is on screen, or `null`. */
export const firstOnScreen = (
  elements: Iterable<Element>,
): HTMLElement | null => {
  for (const element of elements) {
    if (isOnScreen(element)) {
      return element;
    }
  }
  return null;
};

/** Returns the last element of `elements` that is on screen, or `null`. */
export const lastOnScreen = (elements: Element[]): HTMLElement | null =>
  firstOnScreen([...elements].reverse());

/* The name assistive technology reads: aria-labelledby, then aria-label, then
 * the visible text. */
/** Returns the name assistive technology reads for `element`: `aria-labelledby`, else `aria-label`, else its text. */
export const accessibleName = (element: Element): string => {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  }
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel != null) {
    return ariaLabel.trim();
  }
  /* A form control is named by its `<label for>` before its own text. */
  const label = element.id
    ? Array.from(document.getElementsByTagName('label')).find(
        (candidate) => candidate.htmlFor === element.id,
      )
    : undefined;
  return (label?.textContent ?? element.textContent ?? '').trim();
};

/** Returns every element matching `selector` inside each of `scopes`, in order. */
export const queryAll = (
  scopes: Iterable<ParentNode>,
  selector: string,
): Element[] => {
  const found: Element[] = [];
  for (const scope of scopes) {
    found.push(...Array.from(scope.querySelectorAll(selector)));
  }
  return found;
};

const CONTROL_SELECTOR = 'button, a[href], [role="button"]';

/* A link or button inside `scopes` whose accessible name passes `matches`.
 * Names are compared as strings rather than built into a selector, so a
 * translated label never needs CSS escaping. */
/** Returns the first on-screen button or link inside `scopes` whose accessible name passes `matches`, or `null`. */
export const findControlBy = (
  scopes: Iterable<ParentNode>,
  matches: (name: string) => boolean,
): HTMLElement | null =>
  firstOnScreen(
    queryAll(scopes, CONTROL_SELECTOR).filter((element) =>
      matches(accessibleName(element)),
    ),
  );

/** Returns the first on-screen button or link inside `scopes` named exactly `name`, or `null`. */
export const findControl = (
  scopes: Iterable<ParentNode>,
  name: string,
): HTMLElement | null =>
  findControlBy(scopes, (candidate) => candidate === name);

/** Returns the first on-screen button or link that passes `matches` in the smallest ancestor of `start` holding one, or `null`. */
export const findControlNear = (
  start: Element | null,
  matches: (name: string) => boolean,
): HTMLElement | null => {
  let scope = start?.parentElement ?? null;
  while (scope) {
    const control = findControlBy([scope], matches);
    if (control) {
      return control;
    }
    scope = scope.parentElement;
  }
  return null;
};

/** Returns the elements matching `selector` inside `scopes` whose accessible name is `name`. */
export const named = (
  scopes: Iterable<ParentNode>,
  selector: string,
  name: string,
): Element[] =>
  queryAll(scopes, selector).filter(
    (element) => accessibleName(element) === name,
  );

/** Returns the first on-screen element matching `selector` inside `scopes` named `name`, or `null`. */
export const firstNamed = (
  scopes: Iterable<ParentNode>,
  selector: string,
  name: string,
): HTMLElement | null => firstOnScreen(named(scopes, selector, name));

/* A search field named `name`: its `role="search"` wrapper when it has one,
 * otherwise the input itself. */
/** Returns the search field named `name` inside `scopes` — its `role="search"` wrapper when it has one, else the input — or `null`. */
export const findSearch = (
  scopes: Iterable<ParentNode>,
  name: string,
): HTMLElement | null => {
  const input = firstNamed(scopes, 'input', name);
  return input
    ? (input.closest<HTMLElement>('search, [role="search"]') ?? input)
    : null;
};
