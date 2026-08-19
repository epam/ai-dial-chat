import { FC } from 'react';
import { rehypePromptVariables } from '../../utils/prompt-variables';
import {
  MarkdownRenderer,
  type MarkdownRendererClassNames,
} from '../MarkdownRenderer/MarkdownRenderer';

/** Props for {@link MarkdownWithPlaceholders}. */
export interface MarkdownWithPlaceholdersProps {
  /** Raw markdown string to render, read-only. */
  content: string;
  /** Typography class overrides applied to `<h1>`–`<h6>`. Defaults to no override. */
  headingClassName?: string;
}

/* Stable identity so the renderer's plugin array does not change every render. */
const REHYPE_PLUGINS = [rehypePromptVariables];

/**
 * Renders read-only markdown with every `{{param}}` token wrapped in a
 * `cat-prompt-variable`-classed span the host can style apart from the
 * surrounding prose.
 */
export const MarkdownWithPlaceholders: FC<MarkdownWithPlaceholdersProps> = ({
  content,
  headingClassName,
}) => {
  const classNames: MarkdownRendererClassNames = {
    h1: headingClassName,
    h2: headingClassName,
    h3: headingClassName,
    h4: headingClassName,
    h5: headingClassName,
    h6: headingClassName,
  };

  return (
    <MarkdownRenderer
      content={content}
      rehypePlugins={REHYPE_PLUGINS}
      classNames={classNames}
    />
  );
};
