import { MessageRole, type Message, type StatusMessage } from '../models/chat';

/** Returns `true` when `msg` is a `StatusMessage`. */
export const isStatusMessage = (
  msg: Message | StatusMessage,
): msg is StatusMessage => msg.role === MessageRole.Status;
