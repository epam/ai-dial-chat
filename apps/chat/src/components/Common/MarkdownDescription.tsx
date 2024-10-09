import { useMemo } from 'react';

import classNames from 'classnames';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';

import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';

import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  isShortDescription?: boolean;
  className?: string;
}

export const EntityMarkdownDescription = ({
  children,
  isShortDescription,
  className,
}: Props) => {
  const transformedChildren = useMemo(() => {
    if (isShortDescription && children) {
      const indexOfDelimiter = children.search(DESCRIPTION_DELIMITER_REGEX);
      return children.slice(
        0,
        indexOfDelimiter === -1 ? children.length : indexOfDelimiter,
      );
    } else {
      return children;
    }
  }, [children, isShortDescription]);

  return (
    <MemoizedReactMarkdown
      className={classNames(
        className,
        'prose-sm text-xs hover:prose-a:underline',
      )}
      linkTarget="_blank"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [
          rehypeSanitize,
          {
            ...defaultSchema,
            attributes: {
              ...defaultSchema.attributes,
              span: [...(defaultSchema.attributes?.span || []), ['style']],
            },
          },
        ],
      ]}
    >
      {transformedChildren}
    </MemoizedReactMarkdown>
  );
};
