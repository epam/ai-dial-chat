/* eslint-disable @next/next/no-img-element */
import { Children, ReactNode, memo, useMemo } from 'react';
import { Components, Options } from 'react-markdown';

import classnames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';
import { dataToBlobUrl } from '@/src/utils/app/dataUrl';
import {
  isAllowedImageUrl,
  parseAllowedImageHosts,
} from '@/src/utils/app/image-security';
import { preprocessLaTeX } from '@/src/utils/app/latex';

import { ScreenState } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import {
  mathMLTags,
  modelCursorSign,
  modelCursorSignWithBackquote,
} from '@/src/constants/chat';

import { BlinkingCursor } from '@/src/components/Chat/BlinkingCursor';
import { Table } from '@/src/components/Markdown/Table';

import { CodeBlock } from './CodeBlock';
import { MemoizedReactMarkdown } from './MemoizedReactMarkdown';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import 'katex/dist/katex.min.css';
import isObject from 'lodash-es/isObject';
import partition from 'lodash-es/partition';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const replaceCursor = (cursorSign: string) =>
  cursorSign.replace(modelCursorSignWithBackquote, modelCursorSign);

interface ChatMDComponentProps {
  isShowResponseLoader: boolean;
  content: string;
  isInner?: boolean;
  plainTextMode?: boolean;
}

const transformUri = (src: string): string => {
  return getMappedAttachmentUrl(src) ?? '';
};

const getMDComponents = (
  isShowResponseLoader: boolean,
  isInner: boolean,
  allowedImageHosts: string[],
): Components => {
  return {
    code({ className, children, node, ...props }) {
      let childrenAsString = String(children);

      if (childrenAsString?.length) {
        if (childrenAsString[0] == modelCursorSign) {
          return <BlinkingCursor isShowing={isShowResponseLoader} />;
        }

        childrenAsString = `${childrenAsString[0].replace(
          modelCursorSignWithBackquote,
          modelCursorSign,
        )}${childrenAsString.slice(1)}`;
      }

      const match = /language-(\w+)/.exec(className || '');
      const isPlaintextCodeBlock =
        node?.tagName === 'code' &&
        node.position?.end.line !== node.position?.start.line;

      return (match && match[1]) || isPlaintextCodeBlock ? (
        <CodeBlock
          key={`${node?.position?.start.line}:${node?.position?.start.column}`}
          language={(match && match[1]) || ''}
          value={childrenAsString.replace(/\n$/, '')}
          isInner={isInner}
          isLastMessageStreaming={isShowResponseLoader}
          {...props}
        />
      ) : (
        <code className={className} {...props}>
          {childrenAsString}
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
        <th className="break-words border-b border-r border-tertiary bg-layer-4 px-3 py-1 text-sm text-secondary">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="break-words border-b border-r border-tertiary bg-layer-3 px-3 py-1 text-sm">
          {children}
        </td>
      );
    },
    p({ children, className }) {
      if (typeof children === 'string' && children?.length) {
        if (children[0] == modelCursorSign) {
          return <BlinkingCursor isShowing={isShowResponseLoader} />;
        }
        if (children?.[0] == modelCursorSignWithBackquote) {
          children = `${replaceCursor(children[0])}${children.slice(1)}`;
        }
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
      let showCursor = false;
      const childrenArray = Children.toArray(children).map((child) => {
        if (typeof child === 'string' && child?.length) {
          if (child.includes(modelCursorSignWithBackquote)) {
            showCursor = true;
            return child.replaceAll(modelCursorSignWithBackquote, '');
          }
        }
        return child;
      });
      const [summary, content] = partition(
        childrenArray,
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
            'rounded bg-layer-3 [&_details]:bg-layer-1 [&_details_details]:bg-layer-3',
            'mb-1 [&>summary]:border-tertiary [&[open]>summary>svg]:rotate-180 [&[open]>summary]:border-b [&_.codeblock>*]:!bg-layer-1 [&_details>summary]:border-secondary [&_details]:border [&_details]:border-secondary [&_details_.codeblock>*]:!bg-layer-3 [&_details_.codeblock>div]:border-tertiary [&_details_.codeblock]:border-0 [&_details_details>summary]:border-tertiary [&_details_details]:border-0 [&_details_details_.codeblock>*]:!bg-layer-1 [&_details_details_.codeblock>div]:border-secondary [&_details_details_.codeblock]:border',
          )}
          {...props}
          open={showCursor || props.open}
        >
          {summary}
          <div className="p-3">
            {content}
            {showCursor && <BlinkingCursor isShowing={isShowResponseLoader} />}
          </div>
        </details>
      );
    },
    summary({ children, ...props }) {
      return (
        <summary
          className={classnames(
            'flex items-center justify-between gap-3 p-3 text-sm',
            'cursor-pointer [&::marker]:hidden',
          )}
          {...props}
        >
          <span className="truncate">{children}</span>
          <ChevronDown height={18} width={18} className="shrink-0 transition" />
        </summary>
      );
    },
    a({ href, children, ...props }) {
      if (href?.startsWith('data:image')) {
        const blobUrl = dataToBlobUrl(href);
        return <a href={blobUrl ?? href}>{children}</a>;
      }

      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
    img({ src, ...props }) {
      // Strip external images entirely to prevent silent data exfiltration
      // via auto-loaded image URLs. Only same-origin, `data:` and explicitly
      // allowlisted hosts are rendered.
      if (
        !isAllowedImageUrl(
          typeof src === 'string' ? src : undefined,
          allowedImageHosts,
        )
      ) {
        return null;
      }

      return <img src={src} {...props} />;
    },
  };
};

const remarkPlugins: Options['remarkPlugins'] = [
  remarkGfm,
  remarkBreaks,
  [remarkMath, { singleDollarTextMath: false }],
];
const rehypePlugins: Options['rehypePlugins'] = [
  rehypeRaw,
  [rehypeKatex, { output: 'mathml', strict: false }],
  [
    rehypeSanitize,
    {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames || []), ...mathMLTags],
      attributes: {
        ...defaultSchema.attributes,
        code: [
          ...(defaultSchema.attributes?.code || []),
          // Preserve className for syntax highlighting
          ['className'],
        ],
      },
      protocols: {
        src: [...(defaultSchema.protocols?.src ?? []), 'data'],
      },
    },
  ],
  [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
];

export const ChatMDComponent = memo(
  ({
    isShowResponseLoader,
    content,
    isInner = false,
    plainTextMode = false,
  }: ChatMDComponentProps) => {
    const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
    const allowedImageSources = useAppSelector(
      SettingsSelectors.selectAllowedImageSources,
    );

    const screenState = useScreenState();

    const mdClassNames = classnames(
      'prose min-w-full dark:prose-invert prose-a:text-primary prose-a:underline',
      isChatFullWidth && 'max-w-none',
      isOverlay && 'text-sm',
      (screenState === ScreenState.SM || isOverlay) && 'leading-[150%]',
    );

    const allowedImageHosts = useMemo(
      () => parseAllowedImageHosts(allowedImageSources),
      [allowedImageSources],
    );

    const components = useMemo(
      () => getMDComponents(isShowResponseLoader, isInner, allowedImageHosts),
      [isShowResponseLoader, isInner, allowedImageHosts],
    );

    const processedContent = preprocessLaTeX(content);

    if (plainTextMode) {
      return (
        <div className={mdClassNames}>
          {`${processedContent}${isShowResponseLoader ? modelCursorSignWithBackquote : ''}`}
        </div>
      );
    }

    return (
      <MemoizedReactMarkdown
        className={mdClassNames}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        urlTransform={transformUri}
      >
        {`${processedContent}${isShowResponseLoader ? modelCursorSignWithBackquote : ''}`}
      </MemoizedReactMarkdown>
    );
  },
);
ChatMDComponent.displayName = 'ChatMDComponent';
