import { Components } from 'react-markdown';

import BlinkingCursor from '../Chat/BlinkingCursor';
import {
  modelCursorSign,
  modelCursorSignWithBackquote,
} from '../Chat/chatConstants';
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
        <table className="border-collapse border border-black px-3 py-1 dark:border-white">
          {children}
        </table>
      );
    },
    th({ children }) {
      return (
        <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="break-words border border-black px-3 py-1 dark:border-white">
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
      return <p className={className}>{children}</p>;
    },
  };
};

const ChatMDComponent = ({
  isShowResponseLoader,
  content,
  isInner = false,
}: ChatMDComponentProps) => {
  return (
    <>
      <MemoizedReactMarkdown
        className={`prose flex-1 dark:prose-invert`}
        remarkPlugins={[remarkGfm]}
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
