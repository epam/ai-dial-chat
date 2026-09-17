import {
  MarkdownRenderer,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';

/*
 * An agent description is short prose — a scope note or a disclaimer — not a
 * document, so every block element stays on the small secondary scale the
 * rest of the empty-screen copy uses. Links keep the renderer's own accent
 * treatment.
 */
const DESCRIPTION_CLASS_NAMES: MarkdownRendererClassNames = {
  h1: 'dial-small-semi-text',
  h2: 'dial-small-semi-text',
  h3: 'dial-small-semi-text',
  h4: 'dial-small-semi-text',
  h5: 'dial-small-semi-text',
  h6: 'dial-small-semi-text',
  p: 'dial-small-text',
  ul: 'dial-small-text',
  ol: 'dial-small-text',
};

interface Props {
  /** The selected agent's description, rendered as markdown. */
  content: string;
}

/** Renders the selected agent's own description on the empty-chat screen. */
const AgentDescription: FC<Props> = ({ content }) => (
  <MarkdownRenderer
    content={content}
    classNames={DESCRIPTION_CLASS_NAMES}
    containerClassName="mb-4 mt-4 max-w-3xl text-center text-secondary"
  />
);

export default memo(AgentDescription);
