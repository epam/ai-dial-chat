import { FocusEvent } from 'react';

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};

export const getTopicColors = (topic: string) => ({
  backgroundColor: `var(--bg-topic-${topic.toLowerCase()}, var(--bg-topic-default, #5C8DEA2B))`,
  borderColor: `var(--stroke-topic-${topic.toLowerCase()}, var(--stroke-topic-default, #5C8DEA))`,
});
