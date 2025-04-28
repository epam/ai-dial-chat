import { Components } from 'react-markdown';
import { PluggableList } from 'react-markdown/lib/react-markdown';

import classnames from 'classnames';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';
import { convertLaTeXToMarkdownMath } from '@/src/utils/converters';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import {
  modelCursorSign,
  modelCursorSignWithBackquote,
} from '@/src/constants/chat';

import BlinkingCursor from '@/src/components/Chat/BlinkingCursor';
import { Table } from '@/src/components/Markdown/Table';

import { CodeBlock } from './CodeBlock';
import { MemoizedReactMarkdown } from './MemoizedReactMarkdown';

import 'katex/dist/katex.min.css';
import rehypeKatex from 'rehype-katex';
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
      if (children.length) {
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
      if (children.length) {
        if (children[0] == modelCursorSign) {
          return <BlinkingCursor isShowing={isShowResponseLoader} />;
        }
      }
      if (children[0] == modelCursorSignWithBackquote) {
        children[0] = replaceCursor(children[0] as string);
      }
      return (
        <p className={classnames(className, { 'text-sm': isInner })}>
          {children}
        </p>
      );
    },
  };
};

const ChatMDComponent = ({
  isShowResponseLoader,
  content,
  isInner = false,
}: ChatMDComponentProps) => {
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const mdClassNames = classnames(
    'prose min-w-full leading-[150%] dark:prose-invert prose-a:text-primary prose-a:underline',
    isChatFullWidth && 'max-w-none',
    isOverlay ? 'text-sm' : 'md:leading-normal',
  );

  const processedContent = convertLaTeXToMarkdownMath(content);

  return (
    <MemoizedReactMarkdown
      className={mdClassNames}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex] as PluggableList}
      linkTarget="_blank"
      components={getMDComponents(isShowResponseLoader, isInner)}
      transformImageUri={transformUri}
      transformLinkUri={transformUri}
    >
      {`${processedContent}${isShowResponseLoader ? modelCursorSignWithBackquote : ''}`}
    </MemoizedReactMarkdown>
  );
};

export default ChatMDComponent;
