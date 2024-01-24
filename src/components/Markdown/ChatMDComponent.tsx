import { Components } from 'react-markdown';

import classnames from 'classnames';

import { isOnlySmallScreen } from '@/src/utils/app/mobile';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import {
  modelCursorSign,
  modelCursorSignWithBackquote,
} from '../../constants/chat';

import BlinkingCursor from '../Chat/BlinkingCursor';
import { CodeBlock } from './CodeBlock';
import { MemoizedReactMarkdown } from './MemoizedReactMarkdown';

import remarkGfm from 'remark-gfm';

export const replaceCursor = (cursorSign: string) =>
  cursorSign.replace(modelCursorSignWithBackquote, modelCursorSign);

interface ChatMDComponentProps {
  isShowResponseLoader: boolean;
  content: string;
  isInner?: boolean;
}

export const getMDComponents = (
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
        <div className="max-w-full overflow-auto">
          <table className="border-collapse border border-tertiary px-3 py-1 text-sm">
            {children}
          </table>
        </div>
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
        <td className="break-words border border-tertiary px-3 py-1 text-sm">
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
  const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);

  const mdClassNames = classnames(
    'prose dark:prose-invert prose-a:text-accent-primary prose-a:no-underline hover:prose-a:underline',
    {
      'max-w-none': isChatFullWidth,
      'text-sm': isIframe,
      'leading-[150%]': isOnlySmallScreen() || isIframe,
    },
  );

  return (
    <>
      <MemoizedReactMarkdown
        className={mdClassNames}
        remarkPlugins={[remarkGfm]}
        linkTarget="_blank"
        components={getMDComponents(isShowResponseLoader, isInner)}
      >
        {`${content}${
          isShowResponseLoader ? modelCursorSignWithBackquote : ''
        }`}
      </MemoizedReactMarkdown>
    </>
  );
};

export default ChatMDComponent;
