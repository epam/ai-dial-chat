import { FC } from 'react';

const typingDotDelays = [0, 0.2, 0.4];

interface StreamingTypingDotsProps {
  /** CSS color value for each dot (e.g. `'var(--controls-bg-accent-primary)'`). Defaults to the `bg-controls-accent-primary` Tailwind color. */
  dotColor?: string;
}

/** Streaming typing indicator rendered as three animated dots. */
export const StreamingTypingDots: FC<StreamingTypingDotsProps> = ({
  dotColor,
}) => (
  <div className="flex items-center gap-1.5 pt-2" aria-hidden="true">
    {typingDotDelays.map((delay) => (
      <span
        key={delay}
        className="animate-cm-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-controls-accent-primary"
        style={{ animationDelay: `${delay}s`, ...(dotColor && { background: dotColor }) }}
      />
    ))}
  </div>
);
