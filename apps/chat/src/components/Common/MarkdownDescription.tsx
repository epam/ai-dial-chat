import { useMemo } from 'react';

import classNames from 'classnames';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';

import { MemoizedReactMarkdown } from '@/src/components/Markdown/MemoizedReactMarkdown';

import rehypeExternalLinks from 'rehype-external-links';
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
        'prose-sm break-words text-xs prose-a:break-all prose-a:underline prose-ol:pl-2 sm:prose-ol:pl-[1.625em]',
      )}
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
        [
          rehypeExternalLinks,
          { target: '_blank', rel: ['noopener', 'noreferrer'] },
        ],
      ]}
    >
      {transformedChildren}
    </MemoizedReactMarkdown>
  );
};
