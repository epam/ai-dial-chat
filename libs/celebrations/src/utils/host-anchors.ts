import type { CelebrationAnchors } from '../models/celebration';

const DEFAULT_WELCOME_REGION = '[role="region"]';

/** Selector of conversation links in the host history, or `null` without history anchors. */
export const getHistoryLinkSelector = ({
  historyContainer,
  historyRowLink,
}: CelebrationAnchors): string | null =>
  historyContainer && historyRowLink
    ? `.${historyContainer} ${historyRowLink}`
    : null;

/** Selector of the host history container, or `null` without one. */
export const getHistoryContainerSelector = ({
  historyContainer,
}: CelebrationAnchors): string | null =>
  historyContainer ? `.${historyContainer}` : null;

/** Selector of headings and buttons inside the host history, or `null` without one. */
export const getHistoryControlsSelector = ({
  historyContainer,
}: CelebrationAnchors): string | null =>
  historyContainer
    ? `.${historyContainer} h2, .${historyContainer} button`
    : null;

/** Returns every element matching a selector, or none for a missing selector. */
export const queryAllOrNone = <T extends Element = Element>(
  selector: string | null,
  root: ParentNode = document,
): T[] => (selector ? Array.from(root.querySelectorAll<T>(selector)) : []);

/** Returns the start-page region around an element. */
export const findWelcomeRegion = (
  element: Element | null | undefined,
  { welcomeRegion }: CelebrationAnchors,
): Element | null =>
  element?.closest(welcomeRegion ?? DEFAULT_WELCOME_REGION) ?? null;
