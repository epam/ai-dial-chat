import { useMemo } from 'react';

import classNames from 'classnames';

import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';

import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  isShortDescription?: boolean;
  className?: string;
}

const getMinIndex = (...indexes: number[]) => {
  const foundIndexes = indexes.filter((i) => i !== -1);
  return foundIndexes.length ? Math.min(...foundIndexes) : -1;
};

export const EntityMarkdownDescription = ({
  children,
  isShortDescription,
  className,
}: Props) => {
  const transformedChildren = useMemo(() => {
    if (isShortDescription) {
      const indexOfDelimiter = getMinIndex(
        children.indexOf('\n\n'),
        children.indexOf('\n \n'),
      );
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
