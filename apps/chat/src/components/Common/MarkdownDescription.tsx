import { useMemo } from 'react';

import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';

import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  isShortDescription?: boolean;
}

export const EntityMarkdownDescription = ({
  children,
  isShortDescription,
}: Props) => {
  const transformedChildren = useMemo(() => {
    if (isShortDescription) {
      const indexOfDelimiter = children.indexOf('\n\n');
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
      className="font-medium leading-4 hover:prose-a:underline"
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
