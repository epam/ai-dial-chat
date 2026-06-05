import {
  MessageRole,
  type Message,
  type StatusMessage,
} from '../models/chat.js';

/**
 * Narrows a `Message` to `StatusMessage` when its role is `MessageRole.Status`.
 * The parameter accepts `Message | StatusMessage` because `StatusMessage.custom_content`
 * is not assignable to `Message.custom_content`, so `StatusMessage` cannot be a
 * structural subtype of `Message`. Callers with `Message`-typed values can still pass
 * them directly since `Message` is assignable to the union.
 */
export const isStatusMessage = (
  msg: Message | StatusMessage,
): msg is StatusMessage => msg.role === MessageRole.Status;
