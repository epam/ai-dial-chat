import { createContext, useContext } from 'react';

/**
 * The start cell of `ChatLayout`'s desktop top bar, for a page inside the
 * layout to render its own header content into with a portal (the project
 * chat's breadcrumb). `null` outside the layout and until the cell mounts.
 */
export const ChatLayoutHeaderSlotContext = createContext<HTMLElement | null>(
  null,
);

/** The `ChatLayout` desktop header's start cell, or `null` when there is none. */
export const useChatLayoutHeaderSlot = (): HTMLElement | null =>
  useContext(ChatLayoutHeaderSlotContext);
