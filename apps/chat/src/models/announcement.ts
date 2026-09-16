/*
 * Re-exported rather than redeclared: `buildAnnouncementSignature` reads these
 * fields to decide whether a dismissed banner comes back, so a field the app
 * adds here but the library does not know about would be a silently
 * un-invalidating announcement.
 */
export type {
  AnnouncementListItem as AnnouncementItem,
  AnnouncementListItemLink as AnnouncementLink,
} from '@epam/ai-dial-chat-hooks';
