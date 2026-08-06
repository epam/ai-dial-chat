import type { Stage } from '@epam/ai-dial-chat-shared';
import { mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type {
  StagesPanelLabels,
  StageTypography,
} from '../../models/stages-props';
import { cleanStageName, isIdentifierLike } from '../../utils/stage-name';
import { StageIcon } from '../StageIcon/StageIcon';
import { StageMarkdownContent } from '../StageMarkdownContent/StageMarkdownContent';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** Props for {@link StageItem}. */
export interface StageItemProps {
  /** The stage data to render. */
  stage: Stage;
  /** Whether this stage is the currently executing (live) stage. */
  isLive: boolean;
  /** Typography configuration applied to stage text elements. */
  typography?: StageTypography;
  /** User-visible strings. */
  labels?: StagesPanelLabels;
  /** Overrides the displayed name; used to relabel individual attempts (e.g. `'Attempt 2'`) inside a `×N` group. */
  nameOverride?: string;
}

/** Renders a single stage row, optionally expandable to show its content. */
export const StageItem: FC<StageItemProps> = ({
  stage,
  isLive,
  typography,
  labels,
  nameOverride,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    copyAriaLabel = 'Copy stage content',
    runningAriaLabel,
    failedAriaLabel,
  } = labels ?? {};
  const { name: cleanedName, durationLabel } = cleanStageName(stage.name);
  const displayName = nameOverride ?? cleanedName;
  const isMono = !nameOverride && isIdentifierLike(cleanedName);
  const isFailed = stage.status === StageStatus.Failed;

  const hasExpandableContent = !!stage.content;

  const header = (
    <>
      <span className="flex flex-none items-center">
        <StageIcon
          status={stage.status}
          isLive={isLive}
          runningLabel={runningAriaLabel}
          failedLabel={failedAriaLabel}
        />
      </span>
      <span
        className={mergeClasses(
          'min-w-0 max-w-[22rem] truncate',
          typography?.fontClassName ?? 'dial-small-text',
          styles.stageName,
          isFailed && styles.stageNameFailed,
          isMono && styles.monoName,
        )}
      >
        <DialEllipsisTooltip text={displayName || stage.status || ''} />
      </span>
      {stage.tag && (
        <span
          className={mergeClasses(
            'flex-none uppercase',
            typography?.countFontClassName ?? 'dial-tiny-text',
            styles.tag,
          )}
        >
          {stage.tag}
        </span>
      )}
      {durationLabel && (
        <span
          className={mergeClasses(
            'flex-none',
            typography?.countFontClassName ?? 'dial-tiny-text',
            styles.duration,
          )}
        >
          {durationLabel}
        </span>
      )}
      {hasExpandableContent && (
        <span className={mergeClasses('flex-none', styles.iconSecondary)}>
          {isOpen ? (
            <IconChevronDown size={DIAL_ICON_SIZE.SM} aria-hidden />
          ) : (
            <IconChevronRight
              size={DIAL_ICON_SIZE.SM}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          )}
        </span>
      )}
    </>
  );

  const rowClassName = mergeClasses(
    'flex w-full items-center gap-2 px-2 py-1.5',
    styles.row,
  );

  if (!hasExpandableContent) {
    return <div className={rowClassName}>{header}</div>;
  }

  return (
    <div>
      <div className={rowClassName}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
        >
          {header}
        </button>
      </div>
      <div
        className={mergeClasses(
          'grid overflow-hidden transition-[grid-template-rows] duration-[250ms] ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-2 flex flex-col gap-3 py-1 ps-8">
            {stage.content && (
              <div className="max-h-[300px] overflow-y-auto">
                <StageMarkdownContent
                  content={stage.content}
                  typography={typography}
                  copyAriaLabel={copyAriaLabel}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
