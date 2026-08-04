import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSpinner } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import type {
  AttachmentCanvasLabels,
  HtmlCanvasContent,
} from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { CodeContent } from '../CodeContent/CodeContent';

/** Props for {@link HtmlContent}. */
export interface HtmlContentProps {
  /** The HTML content to render. */
  content: HtmlCanvasContent;
  /** Labels used inside the HTML viewer. */
  labels: Pick<
    AttachmentCanvasLabels,
    'htmlFrameBlockedLabel' | 'htmlOpenInNewTabLabel'
  >;
  /** When `true`, displays the highlighted HTML source instead of the rendered iframe. */
  isSourceView: boolean;
  /** Accessible title forwarded to the iframe element. */
  title?: string;
}

/** Renders HTML content inside a sandboxed iframe, or as highlighted source when `isSourceView` is true. */
export const HtmlContent: FC<HtmlContentProps> = ({
  content,
  labels,
  isSourceView,
  title,
}) => {
  const {
    htmlFrameBlockedLabel = 'This page cannot be displayed in preview',
    htmlOpenInNewTabLabel = 'Open in new tab',
  } = labels;

  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(
    (_e: SyntheticEvent<HTMLIFrameElement>) => {
      setIsLoading(false);
      if (content.srcdoc != null) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc == null) {
          setIsBlocked(true);
        }
      } catch {
        setIsBlocked(true);
      }
    },
    [content.srcdoc],
  );

  const handleError = useCallback(() => {
    setIsLoading(false);
    setIsBlocked(true);
  }, []);

  if (isSourceView && content.srcdoc != null) {
    return (
      <CodeContent
        content={{
          type: AttachmentContentType.Code,
          text: content.srcdoc,
          language: 'html',
        }}
      />
    );
  }

  if (isBlocked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-center">{htmlFrameBlockedLabel}</p>
        {content.url != null && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${htmlOpenInNewTabLabel} (opens in new tab)`}
            className="rounded px-3 py-1.5 text-sm font-medium"
          >
            {htmlOpenInNewTabLabel}
          </a>
        )}
      </div>
    );
  }

  const isSrcdoc = content.srcdoc != null;
  const iframeSrc = !isSrcdoc ? content.url : undefined;
  const iframeSrcdoc = isSrcdoc ? content.srcdoc : undefined;

  return (
    <div className="relative h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <DialSpinner />
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onLoad/onError are resource events, not mouse/keyboard listeners */}
      <iframe
        ref={iframeRef}
        title={title}
        src={iframeSrc}
        srcDoc={iframeSrcdoc}
        sandbox={isSrcdoc ? 'allow-scripts' : 'allow-scripts allow-same-origin'}
        className={mergeClasses(
          'h-full w-full border-none',
          isLoading ? 'invisible' : '',
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
