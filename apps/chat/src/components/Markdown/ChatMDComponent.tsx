import { Children, ReactNode, memo } from 'react';
import { Components } from 'react-markdown';
import { PluggableList } from 'react-markdown/lib/react-markdown';

import classnames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';
import { preprocessLaTeX } from '@/src/utils/app/latex';

import { ScreenState } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import {
  modelCursorSign,
  modelCursorSignWithBackquote,
} from '@/src/constants/chat';

import { BlinkingCursor } from '@/src/components/Chat/BlinkingCursor';
import { Table } from '@/src/components/Markdown/Table';

import { CodeBlock } from './CodeBlock';
import { MemoizedReactMarkdown } from './MemoizedReactMarkdown';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import 'katex/dist/katex.min.css';
import { isObject, partition } from 'lodash-es';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const replaceCursor = (cursorSign: string) =>
  cursorSign.replace(modelCursorSignWithBackquote, modelCursorSign);

interface ChatMDComponentProps {
  isShowResponseLoader: boolean;
  content: string;
  isInner?: boolean;
}

const transformUri = (src: string): string => {
  return getMappedAttachmentUrl(src) ?? '';
};

const getMDComponents = (
  isShowResponseLoader: boolean,
  isInner: boolean,
): Components => {
  return {
    code({ inline, className, children, ...props }) {
      if (children?.length) {
        if (children[0] == modelCursorSign) {
          return <BlinkingCursor isShowing={isShowResponseLoader} />;
        }

        children[0] = (children[0] as string).replace(
          modelCursorSignWithBackquote,
          modelCursorSign,
        );
      }

      const match = /language-(\w+)/.exec(className || '');

      return !inline ? (
        <CodeBlock
          key={Math.random()}
          language={(match && match[1]) || ''}
          value={String(children).replace(/\n$/, '')}
          isInner={isInner}
          isLastMessageStreaming={isShowResponseLoader}
          {...props}
        />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <Table isLastMessageStreaming={isShowResponseLoader}>{children}</Table>
      );
    },
    th({ children }) {
      return (
        <th className="break-words border border-tertiary bg-layer-4 px-3 py-1 text-sm text-secondary">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="break-words border border-tertiary bg-layer-3 px-3 py-1 text-sm">
          {children}
        </td>
      );
    },
    p({ children, className }) {
      if (children?.length) {
        if (children[0] == modelCursorSign) {
          return <BlinkingCursor isShowing={isShowResponseLoader} />;
        }
      }
      if (children?.[0] == modelCursorSignWithBackquote) {
        children[0] = replaceCursor(children[0] as string);
      }
      return (
        <p className={classnames(className, { 'text-sm': isInner })}>
          {children}
        </p>
      );
    },
    details({ children, ...props }) {
      // In order to style the contents paddings correctly, we need to wrap them into container
      // Contents of <details> element follow the summary element unwrapped by default,
      // so styling them otherwise would be hacky.
      const [summary, content] = partition(
        Children.toArray(children),
        (child: ReactNode) =>
          isObject(child) &&
          'type' in child &&
          isObject(child.type) &&
          'name' in child.type &&
          child.type.name === 'summary',
      );

      return (
        <details
          className={classnames(
            'my-4 rounded bg-layer-3',
            ' [&[open]>summary>svg]:rotate-180 [&[open]>summary]:border-b',
          )}
          {...props}
        >
          {summary}
          <div className="p-3">{content}</div>
        </details>
      );
    },
    summary({ children, ...props }) {
      return (
        <summary
          className={classnames(
            'flex items-center justify-between gap-3 border-tertiary p-3 text-sm',
            'cursor-pointer [&::marker]:hidden',
          )}
          {...props}
        >
          <span className="truncate">{children}</span>
          <ChevronDown height={18} width={18} className="shrink-0 transition" />
        </summary>
      );
    },
  };
};

const remarkPlugins: PluggableList = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: true }],
];
const rehypePlugins = [
  rehypeRaw,
  [rehypeKatex, { output: 'mathml', strict: false }],
  [
    rehypeSanitize,
    {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        code: [
          ...(defaultSchema.attributes?.code || []),
          // Preserve className for syntax highlighting
          ['className'],
        ],
      },
    },
  ],
] as PluggableList;

export const ChatMDComponent = memo(
  ({
    isShowResponseLoader,
    content,
    isInner = false,
  }: ChatMDComponentProps) => {
    const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

    const screenState = useScreenState();

    const mdClassNames = classnames(
      'prose min-w-full dark:prose-invert prose-a:text-primary prose-a:underline',
      isChatFullWidth && 'max-w-none',
      isOverlay && 'text-sm',
      (screenState === ScreenState.SM || isOverlay) && 'leading-[150%]',
    );

    const processedContent = preprocessLaTeX(content);

    return (
      <MemoizedReactMarkdown
        className={mdClassNames}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        linkTarget="_blank"
        components={getMDComponents(isShowResponseLoader, isInner)}
        transformImageUri={transformUri}
        transformLinkUri={transformUri}
      >
        {`${processedContent}${isShowResponseLoader ? modelCursorSignWithBackquote : ''}`}
      </MemoizedReactMarkdown>
    );
  },
);
ChatMDComponent.displayName = 'ChatMDComponent';
