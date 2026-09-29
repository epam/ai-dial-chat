import type { CodeBlockTheme } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { LinkButton, Spinner } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  type SyntheticEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  AttachmentCanvasLabels,
  HtmlCanvasContent,
} from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { CodeContent } from '../CodeContent/CodeContent';
import styles from './HtmlContent.module.scss';

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
  /** Syntax-highlight color theme forwarded to the source-view `CodeContent`. When omitted, `CodeContent` falls back to `CodeBlockTheme.Light`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Typography class applied to the "Open in new tab" link in the blocked-state panel. Defaults to `'dial-body-semi-text'`. */
  openInNewTabButtonTypographyClassName?: string;
}

/** Renders HTML content inside a sandboxed iframe, or as highlighted source when `isSourceView` is true. */
export const HtmlContent: FC<HtmlContentProps> = memo(
  ({
    content,
    labels,
    isSourceView,
    title,
    codeBlockTheme,
    openInNewTabButtonTypographyClassName = 'dial-body-semi-text',
  }) => {
    const {
      htmlFrameBlockedLabel = 'This page cannot be displayed in preview',
      htmlOpenInNewTabLabel = 'Open in new tab',
    } = labels;

    const [isLoading, setIsLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);
    const [fetchedSourceText, setFetchedSourceText] = useState<
      string | undefined
    >(undefined);
    const [isSourceLoading, setIsSourceLoading] = useState(false);
    const [hasSourceFetchFailed, setHasSourceFetchFailed] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
      setIsLoading(true);
      setIsBlocked(false);
      setFetchedSourceText(undefined);
      setIsSourceLoading(false);
      setHasSourceFetchFailed(false);
    }, [content]);

    const prevIsSourceViewRef = useRef(isSourceView);
    if (prevIsSourceViewRef.current !== isSourceView) {
      prevIsSourceViewRef.current = isSourceView;
      /* Reset synchronously during render (not in an effect) so a retry
       * after a failed fetch never paints the fallback iframe for a frame
       * before `willFetchSourceText` below can recompute with the reset
       * flag. */
      if (isSourceView && hasSourceFetchFailed) {
        setHasSourceFetchFailed(false);
      }
    }

    useEffect(() => {
      if (
        !isSourceView ||
        content.srcdoc != null ||
        content.resolveSourceText == null ||
        fetchedSourceText != null
      ) {
        return;
      }
      let isCancelled = false;
      const resolveSourceText = content.resolveSourceText;
      const fetchSourceText = async (): Promise<void> => {
        setIsSourceLoading(true);
        try {
          const text = await resolveSourceText();
          if (!isCancelled) setFetchedSourceText(text);
        } catch {
          /* Falls through to the rendered iframe below; the toggle retries on the next click. */
          if (!isCancelled) setHasSourceFetchFailed(true);
        } finally {
          if (!isCancelled) setIsSourceLoading(false);
        }
      };
      void fetchSourceText();
      return () => {
        isCancelled = true;
      };
    }, [isSourceView, content, fetchedSourceText]);

    const isSameOriginUrl =
      content.isSameOriginUrl === true && content.url != null;
    const isSrcdoc = !isSameOriginUrl && content.srcdoc != null;

    const handleLoad = useCallback(
      (_e: SyntheticEvent<HTMLIFrameElement>) => {
        setIsLoading(false);
        if (isSrcdoc || isSameOriginUrl) return;
        try {
          const doc = iframeRef.current?.contentDocument;
          if (doc == null) {
            setIsBlocked(true);
          }
        } catch {
          setIsBlocked(true);
        }
      },
      [isSrcdoc, isSameOriginUrl],
    );

    const handleError = useCallback(() => {
      setIsLoading(false);
      setIsBlocked(true);
    }, []);

    const sourceText = content.srcdoc ?? fetchedSourceText;
    const canViewSource =
      content.srcdoc != null || content.resolveSourceText != null;
    /* True from the very first render where `isSourceView` flips on, before
     * the fetch effect below has had a chance to commit `isSourceLoading` —
     * without it, that render would briefly show the live iframe instead of
     * the spinner. */
    const willFetchSourceText =
      content.srcdoc == null &&
      content.resolveSourceText != null &&
      fetchedSourceText == null &&
      !hasSourceFetchFailed;

    if (
      isSourceView &&
      canViewSource &&
      (sourceText != null || isSourceLoading || willFetchSourceText)
    ) {
      if (sourceText == null) {
        return (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        );
      }
      return (
        <CodeContent
          content={{
            type: AttachmentContentType.Code,
            text: sourceText,
            language: 'html',
          }}
          codeBlockTheme={codeBlockTheme}
        />
      );
    }

    if (isBlocked) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
          <p className="text-center">{htmlFrameBlockedLabel}</p>
          {content.url != null && (
            /*
             * `href` makes `LinkButton` render a real anchor, so the target
             * stays middle-clickable, copyable, and openable in a background
             * tab.
             */
            <LinkButton
              href={content.url}
              target="_blank"
              label={htmlOpenInNewTabLabel}
              className={styles.openInNewTabButton}
              textClassName={openInNewTabButtonTypographyClassName}
            />
          )}
        </div>
      );
    }

    const iframeSrc = !isSrcdoc ? content.url : undefined;
    const iframeSrcdoc = isSrcdoc ? content.srcdoc : undefined;

    return (
      <div className="relative h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onLoad/onError are resource events, not mouse/keyboard listeners */}
        <iframe
          ref={iframeRef}
          title={title}
          src={iframeSrc}
          srcDoc={iframeSrcdoc}
          sandbox={
            isSrcdoc || isSameOriginUrl
              ? 'allow-scripts'
              : 'allow-scripts allow-same-origin'
          }
          className={mergeClasses(
            'h-full w-full border-none',
            isLoading ? 'invisible' : '',
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  },
);
