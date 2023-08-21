import { useEffect, useState } from 'react';

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
  const [transformedChildren, setTransformedChildren] = useState('');

  useEffect(() => {
    if (isShortDescription) {
      const indexOfDelimiter = children.indexOf('\n\n');
      setTransformedChildren(
        children.slice(
          0,
          indexOfDelimiter === -1 ? children.length : indexOfDelimiter,
        ),
      );
    } else {
      setTransformedChildren(children);
    }
  }, [children, isShortDescription]);

  return (
    <MemoizedReactMarkdown
      className="markdown"
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
