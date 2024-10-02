import { FocusEvent } from 'react';

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};

export const getTopicColors = (
  topic: string,
  {
    defaultBgColor,
    defaultBorderColor,
  }: { defaultBgColor?: string; defaultBorderColor?: string } = {
    defaultBgColor: 'var(--bg-accent-primary-alpha)',
    defaultBorderColor: 'var(--stroke-accent-primary)',
  },
) => ({
  backgroundColor: `var(--bg-topic-${topic.toLowerCase()}, ${defaultBgColor})`,
  borderColor: `var(--stroke-topic-${topic.toLowerCase()}, ${defaultBorderColor})`,
});
