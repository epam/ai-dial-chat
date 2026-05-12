import { DialTextarea } from '@epam/ai-dial-ui-kit';
import { KeyboardEvent, useRef, useState } from 'react';

import '@epam/ai-dial-ui-kit/styles.css';

export interface ConversationInputProps {
  placeholder?: string;
  disabled?: boolean;
  initialMessage?: string;
  welcomeText?: string;
  onSend?: (message: string) => void;
}

export const ConversationInput = ({
  onSend,
  initialMessage = '',
  placeholder = 'Type a new prompt or use "/" to select one',
  disabled = false,
  welcomeText = 'Hello World, good day for prompting!',
}: ConversationInputProps) => {
  const [message, setMessage] = useState(initialMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend?.(message.trim());
      setMessage('');
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex w-full flex-col items-center gap-6 p-4">
      {welcomeText && (
        <h1 className="conversation-input-welcome dial-h1-text text-center">
          {welcomeText}
        </h1>
      )}
      <DialTextarea
        ref={textareaRef}
        value={message}
        onChange={(value: string) => setMessage(value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !message.trim()}
      >
        Send
      </button>
    </div>
  );
};
