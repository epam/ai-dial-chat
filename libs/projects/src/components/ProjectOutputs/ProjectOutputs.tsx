import { AttachmentCard } from '@epam/ai-dial-attachment-input';
import {
  buildCssVars,
  type DisplayAttachment,
  getAttachmentTypeFromMime,
  mergeClasses,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { GhostButton, LinkButton, LiveRegion } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ProjectOutputItem,
  ProjectOutputsProps,
} from '../../models/project-outputs-props';
import styles from './ProjectOutputs.module.scss';

const DEFAULT_PREVIEW_LIMIT = 6;

const toDisplayAttachment = (item: ProjectOutputItem): DisplayAttachment => ({
  id: item.name,
  name: item.name,
  contentType: item.contentType,
  type: getAttachmentTypeFromMime(item.contentType),
  status: RequestStatus.Idle,
});

const ProjectOutputsComponent: FC<ProjectOutputsProps> = ({
  items,
  onOpenOutput,
  selectedOutputName,
  hasError = false,
  onRetry,
  previewLimit = DEFAULT_PREVIEW_LIMIT,
  labels,
  styles: outputStyles,
}) => {
  const headingId = useId();
  const listId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  /* Set when Retry is activated, so focus can follow the button it removes. */
  const isRetryingRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { colors, typography } = outputStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const helperClassName = typography?.helperClassName ?? 'dial-tiny-text';
  const title = labels?.title ?? 'Outputs';
  const errorLabel = labels?.errorLabel ?? 'Could not load outputs';
  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--po-heading-text': colors?.headingText,
        '--po-secondary-text': colors?.secondaryText,
      }),
    [colors?.headingText, colors?.secondaryText],
  );
  const handleToggleExpanded = useCallback(
    () => setIsExpanded((value) => !value),
    [],
  );
  const handleRetry = useCallback(() => {
    isRetryingRef.current = true;
    onRetry?.();
  }, [onRetry]);

  /* A successful retry removes the focused Retry button; focus moves to the section heading instead of the page body. */
  useEffect(() => {
    if (hasError || !isRetryingRef.current) return;
    isRetryingRef.current = false;
    headingRef.current?.focus();
  }, [hasError]);

  const isVisible = hasError || items.length > 0;
  const hasMore = items.length > previewLimit;
  const visibleItems =
    isExpanded || !hasMore ? items : items.slice(0, previewLimit);
  const openOutputLabel =
    labels?.openOutputLabel ?? ((name: string) => `Preview ${name}`);
  const seeAllLabel =
    labels?.seeAllLabel?.(items.length) ?? `See all (${items.length})`;
  const showLessLabel = labels?.showLessLabel ?? 'Show less';

  /* The live region stays mounted while the section is hidden, so an error is announced when it appears; the visible copy is hidden from assistive tech to be read once. */
  return (
    <div className="contents" style={cssVars}>
      {isVisible && (
        <section
          aria-labelledby={headingId}
          className="flex min-w-0 flex-col gap-2 pt-3"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2
              ref={headingRef}
              id={headingId}
              tabIndex={-1}
              className={mergeClasses('m-0', styles.title, titleClassName)}
            >
              {title}
            </h2>
            {!hasError && hasMore && (
              <LinkButton
                label={isExpanded ? showLessLabel : seeAllLabel}
                aria-expanded={isExpanded}
                aria-controls={listId}
                onClick={handleToggleExpanded}
              />
            )}
          </div>
          {hasError ? (
            <>
              <p
                aria-hidden
                className={mergeClasses(
                  'm-0',
                  styles.secondary,
                  helperClassName,
                )}
              >
                {errorLabel}
              </p>
              {onRetry && (
                <GhostButton
                  className="self-start"
                  label={labels?.retryLabel ?? 'Retry'}
                  onClick={handleRetry}
                />
              )}
            </>
          ) : (
            <ul
              id={listId}
              className={mergeClasses(
                'm-0 flex min-w-0 list-none gap-2 p-0',
                isExpanded ? 'flex-wrap' : 'flex-nowrap overflow-x-auto',
              )}
            >
              {visibleItems.map((item) => (
                <li key={item.name} className="shrink-0">
                  <AttachmentCard
                    attachment={toDisplayAttachment(item)}
                    onClick={onOpenOutput}
                    isSelected={item.name === selectedOutputName}
                    labels={{ clickLabel: openOutputLabel(item.name) }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <LiveRegion visuallyHidden>{hasError ? errorLabel : ''}</LiveRegion>
    </div>
  );
};

/** A project's outputs as a row of file cards that open the file, with an in-place See all. */
export const ProjectOutputs = memo(ProjectOutputsComponent);
