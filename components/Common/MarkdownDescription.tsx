import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';

import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
}

export const EntityMarkdownDescription = ({ children }: Props) => {
  return (
    <MemoizedReactMarkdown
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
      {children}
    </MemoizedReactMarkdown>
  );
};
