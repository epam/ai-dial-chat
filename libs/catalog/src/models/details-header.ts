import type { TablerIcon } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { CredentialsLevel } from '../types/toolset-auth';
import type { CatalogItem } from './catalog-item';
import type { ItemDetailsStyles, ItemDetailsTexts } from './item-details-props';

/**
 * One secondary ("Manage") action, declared once and rendered on whichever
 * surface it lands on: an entry inside the overflow menu, or — when it is the
 * only action left after filtering — a button in the action row. The icon
 * stays a component rather than a rendered node so each surface can size it
 * for itself (SM in the menu, MD on a button).
 */
export interface ManageAction {
  /** Stable key of the action, also the menu item key. */
  key: string;
  /** Visible label. */
  label: ReactNode;
  /** Icon component, sized by the surface that renders it. */
  Icon: TablerIcon;
  /** Menu-entry icon tint. The destructive entries take the menu row's own colour. */
  iconClassName?: string;
  /** Whether the action is destructive. */
  danger?: boolean;
  /** Runs the action. */
  onClick: () => void;
}

/**
 * Props for {@link Header}, exported as `DetailsHeaderProps`: the details
 * view's identity block and action row. Every action is opt-in and hidden
 * when its prop is absent.
 */
export interface HeaderProps {
  /** The item whose identity, folder and actions are shown. */
  item: CatalogItem;
  /** Called by the primary "Use in chat" action. The action is hidden when absent. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Returns `false` to hide the primary action for an item. */
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  /** Called by Share when no `shareOverlay` is given. Share is hidden when both are absent. */
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content. When provided, choosing Share opens
   * this popover instead of calling `onShare`. It anchors to whichever surface
   * carries Share: the header button, or the Manage trigger when
   * `isSharePrimary` has moved the entry into that menu.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Additional caller-supplied rule for whether Share is shown, combined
   * (AND) with the built-in ownership/type rule.
   */
  isShareVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether Share renders as its own header button rather than a
   * Manage-menu entry. Defaults to `true` — the header button. Returning
   * `false` moves Share into the Manage menu, beside Delete. Share renders on
   * one surface or the other, never both.
   */
  isSharePrimary?: (item: CatalogItem) => boolean;
  /** Called by the Manage menu's "Edit" entry, shown only for an editable item. */
  onEdit?: (item: CatalogItem) => void;
  /**
   * Called when "Download" is clicked. In the Manage menu, fire-and-forget:
   * the result is not awaited and no pending state is shown. As the primary
   * action (see `isDownloadPrimary`), the call is awaited and drives a
   * pending/disabled state on the button.
   */
  onDownload?: (item: CatalogItem) => Promise<void> | void;
  /** Additional caller-supplied rule for whether "Download" is shown. Defaults to `true` when absent. */
  isDownloadVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether Download renders as the primary action instead of a
   * Manage-menu entry. Defaults to a Skill whose "Use in chat" primary action
   * is not shown (`item.type === CatalogEntityType.Skill` and no primary
   * action). An item whose Download is primary never also shows it in the
   * Manage menu.
   */
  isDownloadPrimary?: (item: CatalogItem) => boolean;
  /** Called when "Delete" is clicked in the Manage menu. The details panel owns the confirmation step, so this only requests it. */
  onDelete?: (item: CatalogItem) => void;
  /** Called when the recipient-side "Remove from My List" action is clicked for an item shared with the current user. The details panel owns the confirmation step. */
  onUnshare?: (item: CatalogItem) => void;
  /** Additional caller-supplied rule for whether "Remove from My List" is shown, combined (AND) with the built-in `sharedWithMe`/`isMyApp` rule. Defaults to `true` when absent. */
  isUnshareVisible?: (item: CatalogItem) => boolean;
  /** Called when the owner-side "Revoke access" action is clicked for an item the current user owns. The details panel owns the confirmation step. */
  onRevokeShare?: (item: CatalogItem) => void;
  /** Resolves how many users currently hold shared access to an owned item, called when the Manage menu is opened or focused. `0` hides "Revoke access"; `undefined` or a rejection leaves it reachable without a count. */
  onFetchRecipientsCount?: (item: CatalogItem) => Promise<number | undefined>;
  /** Additional caller-supplied rule for whether "Revoke access" is shown, combined (AND) with the built-in `isMyApp` rule and the recipient count. Defaults to `true` when absent. */
  isRevokeShareVisible?: (item: CatalogItem) => boolean;
  /** Called by the credentials action to sign in (OAuth) or to add an API key, for the given credentials level. May return a promise. */
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /** Called to sign out or remove an API key for the given credentials level, when no confirmation is requested through `onRequestLogout`. May return a promise. */
  onLogout?: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void> | void;
  /**
   * Called when the credentials trigger button is clicked and the resolved
   * state is "Manage credentials"/"Manage API keys" — opens the admin
   * credentials-management sub-screen.
   */
  onOpenCredentialsManagement?: () => void;
  /**
   * Called instead of directly logging out when the resolved state is
   * "Log out" for OAuth authentication — opens the logout confirmation
   * without signing out immediately.
   */
  onRequestLogout?: () => void;
  /** Text overrides, shared with `DetailsPanel`. */
  texts?: ItemDetailsTexts;
  /** Style overrides, shared with `DetailsPanel`. */
  detailsStyles?: ItemDetailsStyles;
  /**
   * Controls whether the "Publish" action is shown. Defaults to the same rule
   * as the primary action. Returning `true` is not sufficient on its own:
   * "Publish" is suppressed whenever "Unpublish" is shown, so the panel
   * carries one of the two, never both.
   */
  isPublishVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether whichever of "Publish"/"Unpublish" applies renders as its
   * own header button rather than a Manage-menu entry. Defaults to `false` —
   * the menu entry. It renders on one surface or the other, never both.
   */
  isPublishPrimary?: (item: CatalogItem) => boolean;
  /** Called when the "Publish" button is clicked; the host swaps this panel's content to the publish view. */
  onOpenPublish?: () => void;
  /**
   * Additional caller-supplied rule for whether "Unpublish" is shown,
   * combined (AND) with `hasPublishedFolders` and the presence of
   * `onOpenUnpublish`. Defaults to `true` when absent. When the entry ends up
   * shown, it replaces "Publish" rather than joining it. Supplying it also
   * withholds the Manage slot for an item it returns `true` for while
   * `isPublishHistoryResolved` is still `false`, and lets a lone "Unpublish"
   * render as its own button once history resolves — so the host must
   * resolve history for such an item without waiting for hover, and settle
   * it on failure too.
   */
  isUnpublishVisible?: (item: CatalogItem) => boolean;
  /**
   * Whether the panel has resolved publish history for this item to at least
   * one folder. Withheld while the lookup is unresolved and `false` on zero
   * entries or failure — the request cannot be built without a folder, so an
   * entry shown without one could not do anything if clicked. Default: `false`.
   */
  hasPublishedFolders?: boolean;
  /**
   * Whether the panel's publish-history lookup for this item has settled.
   * Keeps the Manage trigger rendered while an "Unpublish" entry is still
   * pending, so an item that would have no other entry can still start the
   * lookup that produces one. Default: `true` — a host that does not report
   * it is treated as having nothing outstanding.
   */
  isPublishHistoryResolved?: boolean;
  /**
   * Starts the panel's publish-history lookup, called on hover/focus of the
   * Manage trigger and on Manage-menu open, plus on hover/focus of the publish
   * button where `isPublishPrimary` promoted it into the action row. Guarded
   * once per item by the panel.
   */
  onRequestPublishHistory?: () => void;
  /** Called when the "Unpublish" button is clicked; the host swaps this panel's content to the unpublish confirmation. */
  onOpenUnpublish?: () => void;
  /**
   * Renders the header read-only: every action that mutates the item or the
   * caller's relationship to it — Share, Publish/Unpublish, Edit, Delete,
   * "Remove from My List", "Revoke access", and the credentials Log in / Log
   * out / manage button — is withheld. The non-mutating actions (the primary
   * "Use in chat" and Download) still render. Default: false.
   */
  isReadonly?: boolean;
}
