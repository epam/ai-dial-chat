import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  LiveRegion,
  LiveRegionElement,
  Skeleton,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import { IconChevronRight } from '@tabler/icons-react';
import { memo, type FC, type ReactNode } from 'react';
import type { ScheduledTaskConversationBannerProps } from '../../models/scheduled-task-conversation-banner-props';
import styles from './ScheduledTaskConversationBanner.module.scss';

const CARD_LAYOUT_CLASS_NAME =
  'flex items-center justify-between gap-2 rounded-xl border py-3 ps-4 pe-2 desktop:ps-6';

const DETAILS_LINK_LAYOUT_CLASS_NAME =
  'flex h-6 shrink-0 items-center gap-1 rounded-full px-2';

const defaultTaskDetailsAriaLabel = (taskName: string): string =>
  `View task details for ${taskName}`;

/** Compact card above a scheduled-task conversation naming its task, the run time, and a link to the task. */
export const ScheduledTaskConversationBanner: FC<ScheduledTaskConversationBannerProps> =
  memo(
    ({
      isLoading = false,
      isUnavailable = false,
      isTaskDeleted = false,
      displayName,
      timestampLabel,
      renderDetailsLink,
      onRetry,
      labels,
      colors,
      nameClassName = 'dial-small-semi-text',
      textClassName = 'dial-small-text',
      actionClassName = 'dial-tiny-semi-text',
      className,
    }) => {
      const {
        loadingLabel = 'Loading task details…',
        unavailableLabel = 'Task details are unavailable',
        retryLabel = 'Retry',
        taskDetailsLabel = 'Task details',
        taskDetailsAriaLabel = defaultTaskDetailsAriaLabel,
        taskDeletedLabel = 'Task was deleted',
      } = labels ?? {};

      const cssVars = buildCssVars({
        '--stcb-surface': colors?.surface,
        '--stcb-border': colors?.border,
        '--stcb-text': colors?.text,
        '--stcb-details-link': colors?.detailsLink,
        '--stcb-details-link-hover-surface': colors?.detailsLinkHoverSurface,
        '--stcb-focus-outline': colors?.focusOutline,
        '--stcb-deleted-text': colors?.deletedText,
      });

      const isUnavailableShown = !isLoading && isUnavailable;

      let content: ReactNode = null;
      if (isLoading) {
        content = (
          <div className="flex h-5 items-center" aria-hidden>
            <Skeleton
              variant={SkeletonVariant.Rectangular}
              width="220px"
              height="16px"
            />
          </div>
        );
      } else if (isUnavailable) {
        content = onRetry && (
          <GhostButton label={retryLabel} onClick={onRetry} />
        );
      } else {
        content = (
          <>
            <p
              className={mergeClasses(
                styles.text,
                nameClassName,
                'min-w-0 flex-1 wrap-break-word',
              )}
            >
              {displayName}
              {timestampLabel && (
                /* Own line on mobile so the run time stays readable beside the
                 * details link; inline after the name on desktop. */
                <span
                  className={mergeClasses(
                    textClassName,
                    'block desktop:inline',
                  )}
                >
                  {' '}
                  {timestampLabel}
                </span>
              )}
            </p>
            {isTaskDeleted ? (
              <p
                className={mergeClasses(
                  styles.deleted,
                  actionClassName,
                  'flex h-6 shrink-0 items-center px-2',
                )}
              >
                {taskDeletedLabel}
              </p>
            ) : (
              renderDetailsLink({
                className: mergeClasses(
                  styles.detailsLink,
                  actionClassName,
                  DETAILS_LINK_LAYOUT_CLASS_NAME,
                ),
                'aria-label': taskDetailsAriaLabel(displayName),
                children: (
                  <>
                    {taskDetailsLabel}
                    <IconChevronRight
                      size={DIAL_ICON_SIZE.SM}
                      stroke={DIAL_KIT_ICON_STROKE}
                      className="rtl:scale-x-[-1]"
                      aria-hidden
                    />
                  </>
                ),
              })
            )}
          </>
        );
      }

      return (
        /*
         * Both live regions stay mounted across every state so their text is
         * announced. Both are polite: an unavailable task is a state of the
         * page, not a failure of the user's own action. The second is also the
         * visible message; while empty it is
         * `sr-only` and takes no slot in the card's flex row.
         */
        <div
          className={mergeClasses(
            styles.card,
            CARD_LAYOUT_CLASS_NAME,
            className,
          )}
          style={cssVars}
        >
          <LiveRegion visuallyHidden>
            {isLoading ? loadingLabel : ''}
          </LiveRegion>
          <LiveRegion
            as={LiveRegionElement.P}
            className={mergeClasses(styles.text, textClassName)}
          >
            {isUnavailableShown ? unavailableLabel : ''}
          </LiveRegion>
          {content}
        </div>
      );
    },
  );
