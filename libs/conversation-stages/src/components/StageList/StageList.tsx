import { mergeClasses, StageStatus } from '@epam/ai-dial-chat-shared';
import { Accordion, EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  MAX_INDENTED_STAGE_DEPTH,
  STAGE_ACCORDION_CLASS_NAME,
  STAGE_ACCORDION_HEADER_CLASS_NAME,
} from '../../constants/stage-accordion';
import type { StageRow } from '../../models/stage-grouping';
import type { StageExpansion, StageNode } from '../../models/stage-tree';
import type {
  StagesPanelLabels,
  StagesPanelProps,
  StageTypography,
} from '../../models/stages-props';
import { groupStagesByName } from '../../utils/stage-grouping';
import {
  getGroupExpansionKey,
  getStageExpansionKey,
} from '../../utils/stage-tree';
import { StageIcon } from '../StageIcon/StageIcon';
import { StageItem } from '../StageItem/StageItem';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** Props shared by every level of the recursive stage list. */
interface StageLevelProps {
  /** Whether the run is still streaming; unresolved stages then show a spinner. */
  isStreaming: boolean;
  /** Panel-local disclosure state keyed by stage identity. */
  expansion: StageExpansion;
  /** Typography configuration applied to stage text elements. */
  typography?: StageTypography;
  /** User-visible strings. */
  labels?: StagesPanelLabels;
  /** Called when a stage attachment tile is clicked/activated. See {@link StagesPanelProps.onAttachmentClick}. */
  onAttachmentClick?: StagesPanelProps['onAttachmentClick'];
}

/** Props for {@link StageList}. */
export interface StageListProps extends StageLevelProps {
  /** Sibling nodes to render, in encounter order. */
  nodes: StageNode[];
  /** Number of indented levels above this list; the root list is `0`. */
  depth: number;
  /** Extra class name(s) merged onto the list element. */
  className?: string;
}

/** Props for {@link StageNodeItem}. */
interface StageNodeItemProps extends StageLevelProps {
  /** The stage node to render with its descendants. */
  node: StageNode;
  /** Indented levels above this node. */
  depth: number;
  /** Overrides the displayed name (retry attempts). */
  nameOverride?: string;
}

/** Props for {@link StageGroupRow}. */
interface StageGroupRowProps extends StageLevelProps {
  /** The collapsed `×N` group to render. */
  row: StageRow;
  /** Indented levels above this group. */
  depth: number;
}

/* Literal classes keep Tailwind's content scan able to see them. */
const getChildListIndentClass = (depth: number): string =>
  depth <= MAX_INDENTED_STAGE_DEPTH ? 'ps-4' : 'ps-0';

const getAttemptListIndentClass = (depth: number): string =>
  depth <= MAX_INDENTED_STAGE_DEPTH ? 'ps-6' : 'ps-0';

/** One stage row whose disclosure also reveals its own child list. */
const StageNodeItem: FC<StageNodeItemProps> = ({
  node,
  depth,
  nameOverride,
  isStreaming,
  expansion,
  typography,
  labels,
  onAttachmentClick,
}) => {
  const key = getStageExpansionKey(node.stage.index);
  const childDepth = depth + 1;

  return (
    <StageItem
      stage={node.stage}
      nameOverride={nameOverride}
      isLive={isStreaming && node.stage.status == null}
      typography={typography}
      labels={labels}
      onAttachmentClick={onAttachmentClick}
      isExpanded={expansion.isExpanded(key)}
      onToggle={(isExpanded) => expansion.onToggle(key, isExpanded)}
      childList={
        node.children.length > 0 ? (
          <StageList
            nodes={node.children}
            depth={childDepth}
            className={getChildListIndentClass(childDepth)}
            isStreaming={isStreaming}
            expansion={expansion}
            typography={typography}
            labels={labels}
            onAttachmentClick={onAttachmentClick}
          />
        ) : undefined
      }
    />
  );
};

/** Expandable summary row for a collapsed `×N` group of identical sibling attempts. */
const StageGroupRow: FC<StageGroupRowProps> = ({
  row,
  depth,
  isStreaming,
  expansion,
  typography,
  labels,
  onAttachmentClick,
}) => {
  const {
    runningAriaLabel,
    failedAriaLabel,
    attemptLabel = (n: number) => `Attempt ${n}`,
  } = labels ?? {};
  const attempts = row.attempts ?? [];
  const hasUnresolved = attempts.some((a) => a.stage.status == null);
  const hasFailed = attempts.some((a) => a.stage.status === StageStatus.Failed);
  let groupStatus: StageStatus | null = StageStatus.Completed;
  if (hasUnresolved) groupStatus = null;
  else if (hasFailed) groupStatus = StageStatus.Failed;
  const key = getGroupExpansionKey(row.key);
  const isOpen = expansion.isExpanded(key);
  const attemptDepth = depth + 1;

  const header = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex flex-none items-center">
        <StageIcon
          status={groupStatus}
          isLive={isStreaming && hasUnresolved}
          runningLabel={runningAriaLabel}
          failedLabel={failedAriaLabel}
        />
      </span>
      <span
        className={mergeClasses(
          'min-w-0 max-w-[22rem] truncate',
          typography?.fontClassName ?? 'dial-small-text',
          styles.stageName,
          hasFailed && styles.stageNameFailed,
        )}
      >
        <EllipsisTooltip text={row.name} />
      </span>
      <span
        className={mergeClasses(
          'flex-none',
          typography?.countFontClassName ?? 'dial-tiny-text',
          styles.count,
        )}
      >
        ×{attempts.length}
      </span>
    </span>
  );

  /* `-mt-2` turns the kit's 12px spacer into the 4px the attempts list has
     always sat below its summary row. */
  return (
    <Accordion
      title={header}
      expanded={isOpen}
      onToggle={(isExpanded) => expansion.onToggle(key, isExpanded)}
      className={STAGE_ACCORDION_CLASS_NAME}
      headerClassName={mergeClasses(
        STAGE_ACCORDION_HEADER_CLASS_NAME,
        styles.collapseButton,
        styles.row,
        styles.stageHeader,
      )}
      contentClassName={mergeClasses(
        '-mt-2 min-w-0 px-0',
        getAttemptListIndentClass(attemptDepth),
        styles.stageRegion,
      )}
    >
      <ul role="list" className="flex min-w-0 flex-col gap-0.5">
        {/* Attempts mount only while the group is open. */}
        {isOpen &&
          attempts.map((attempt, i) => (
            <li key={attempt.stage.index} role="listitem" className="min-w-0">
              <StageNodeItem
                node={attempt}
                depth={attemptDepth}
                nameOverride={attemptLabel(i + 1)}
                isStreaming={isStreaming}
                expansion={expansion}
                typography={typography}
                labels={labels}
                onAttachmentClick={onAttachmentClick}
              />
            </li>
          ))}
      </ul>
    </Accordion>
  );
};

/** Renders one sibling list; repeated identical names within it collapse into a `×N` group row. */
export const StageList: FC<StageListProps> = ({
  nodes,
  depth,
  className,
  ...levelProps
}) => (
  <ul
    role="list"
    className={mergeClasses('flex min-w-0 flex-col gap-0.5', className)}
  >
    {groupStagesByName(nodes).map((row) => (
      <li key={row.key} role="listitem" className="min-w-0">
        {row.node ? (
          <StageNodeItem node={row.node} depth={depth} {...levelProps} />
        ) : (
          <StageGroupRow row={row} depth={depth} {...levelProps} />
        )}
      </li>
    ))}
  </ul>
);
