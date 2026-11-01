/**
 * How `NewConversationComposer` lays out the empty conversation.
 *
 * - `Welcome` — the empty-chat screen: time-of-day greeting, agent
 *   description, and the input centered on the page.
 * - `Inline` — the input pinned to the bottom, as in an open conversation,
 *   with no greeting; the host renders its own content above it (e.g. the
 *   app preview's greeting bubble).
 * - `Embedded` — the input in normal flow inside a host page (the project
 *   view's main column): no greeting, no centering, no own scroll.
 */
export enum ComposerLayout {
  Welcome = 'welcome',
  Inline = 'inline',
  Embedded = 'embedded',
}
