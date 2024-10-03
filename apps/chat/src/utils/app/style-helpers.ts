import { FocusEvent } from 'react';
import kebabCase from 'lodash-es/kebabCase';

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};

export const getTopicColors = (topic: string) => ({
  backgroundColor: `var(--bg-topic-${kebabCase(topic)}, var(--bg-topic-default, #5C8DEA2B))`,
  borderColor: `var(--stroke-topic-${kebabCase(topic)}, var(--stroke-topic-default, #5C8DEA))`,
});
