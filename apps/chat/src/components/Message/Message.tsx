import { FC, memo } from 'react';
import { Message as MessageType } from '../../types';

/**
 * Props for the Message component
 */
interface MessageProps {
  /** The message data to display */
  message: MessageType;
}

/**
 * Message component that displays a single chat message.
 * Shows user messages on the right with rounded bubble styling,
 * and assistant messages on the left with full-width styling.
 * Includes hover interactions for copy button and timestamp display.
 */
export const Message: FC<MessageProps> = ({ message }) => {
  return (
    <div
      className={`group relative mx-auto flex w-full max-w-3xl p-4 ${
        message.role === 'user'
          ? 'bg-transparent'
          : 'bg-[#f7f7f8] dark:bg-[#2f2f2f]'
      }`}
      role="article"
      aria-label={`${message.role === 'user' ? 'User' : 'Assistant'} message`}
    >
      <div
        className={`break-words text-base ${
          message.role === 'user'
            ? 'ml-auto max-w-[70%] rounded-2xl bg-[#f7f7f8] px-4 py-3 dark:bg-[#2f2f2f] dark:text-[#ececf1]'
            : 'leading-7 text-[#202123] dark:text-[#ececf1]'
        }`}
      >
        {message.content}
      </div>
      {/* Copy button */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(message.content);
        }}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 absolute right-2 top-2 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
        aria-label={`Copy ${message.role === 'user' ? 'user' : 'assistant'} message`}
        title="Copy message (Ctrl+C when focused)"
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
      {/* Timestamp */}
      <div
        className="text-gray-400 dark:text-gray-500 absolute bottom-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          [message.role === 'user' ? 'right' : 'left']: '0.5rem',
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default memo(Message);
