import { FocusEvent } from 'react';

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};

export const getTopicColors = (topic: string) => ({
  backgroundColor: `var(--bg-topic-${topic.toLowerCase()}, var(--bg-accent-primary-alpha))`,
  borderColor: `var(--stroke-topic-${topic.toLowerCase()}, var(--stroke-accent-primary))`,
});
