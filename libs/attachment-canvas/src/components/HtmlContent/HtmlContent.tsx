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
import { HTML_PREVIEW_FRAME_RENDER_MESSAGE } from '../../constants/html-preview';
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
    /* The frame window the HTML was last posted to. Keyed on the window
     * rather than the content so a remounted iframe (new content, or a
     * "View source" round-trip) is posted to again, while the `load` the
     * host document fires after replacing itself is not. */
    const postedFrameWindowRef = useRef<Window | null>(null);
    /* Set while the source view has unmounted the iframe, so switching back
     * shows the spinner until the remounted frame loads. */
    const isFrameUnmountedRef = useRef(false);

    /* Bumped whenever `content` changes and used as the iframe `key`: with
     * `srcdocHostUrl` the iframe `src` can stay identical across contents,
     * and the bootstrap document accepts only one render message, so a new
     * content needs a freshly loaded frame. */
    const contentGenerationRef = useRef({ content, generation: 0 });
    if (contentGenerationRef.current.content !== content) {
      contentGenerationRef.current = {
        content,
        generation: contentGenerationRef.current.generation + 1,
      };
    }
    const frameKey = contentGenerationRef.current.generation;

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
      if (!isSourceView && isFrameUnmountedRef.current) {
        isFrameUnmountedRef.current = false;
        setIsLoading(true);
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
    /* Loading `srcdoc` through a host document (`src=`) instead of the
     * `srcdoc` attribute keeps it from inheriting this page's CSP. */
    const srcdocHostUrl = isSrcdoc ? content.srcdocHostUrl : undefined;
    const srcdoc = content.srcdoc;

    const handleLoad = useCallback(
      (_e: SyntheticEvent<HTMLIFrameElement>) => {
        setIsLoading(false);
        if (srcdocHostUrl != null) {
          /* The host document replaces itself with the posted HTML, which can
           * fire `load` again on the same window — post only once per frame
           * window. Its origin is opaque (sandboxed), so `'*'` is the only
           * matching target. */
          const frameWindow = iframeRef.current?.contentWindow;
          if (
            frameWindow != null &&
            frameWindow !== postedFrameWindowRef.current &&
            srcdoc != null
          ) {
            postedFrameWindowRef.current = frameWindow;
            frameWindow.postMessage(
              { type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html: srcdoc },
              '*',
            );
          }
          return;
        }
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
      [isSrcdoc, isSameOriginUrl, srcdocHostUrl, srcdoc],
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
      isFrameUnmountedRef.current = true;
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

    const iframeSrc = isSrcdoc ? srcdocHostUrl : content.url;
    const iframeSrcdoc =
      isSrcdoc && srcdocHostUrl == null ? content.srcdoc : undefined;

    return (
      <div className="relative h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onLoad/onError are resource events, not mouse/keyboard listeners */}
        <iframe
          key={frameKey}
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
