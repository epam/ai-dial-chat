import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, useMemo } from 'react';
import { CONVERSATION_STAGES_CLASS } from '../../constants/public-class-names';
import { useStageExpansion } from '../../hooks/useStageExpansion/useStageExpansion';
import type { StageExpansion } from '../../models/stage-tree';
import type { StagesPanelProps } from '../../models/stages-props';
import { buildStageTree } from '../../utils/stage-tree';
import { StageList } from '../StageList/StageList';
import styles from './StagesPanel.module.scss';

/** Props for {@link StagesPanelView}. */
export interface StagesPanelViewProps extends StagesPanelProps {
  /** Disclosure state owned by the caller, so it survives the caller re-parenting the panel. */
  expansion: StageExpansion;
}

/**
 * Internal panel body with externally owned disclosure state. `CollapsedGroup`
 * uses it so stage choices survive its one-stage → many-stage layout switch.
 */
export const StagesPanelView: FC<StagesPanelViewProps> = ({
  stages,
  isStreaming,
  className,
  styles: panelStyles,
  labels,
  onAttachmentClick,
  expansion,
}) => {
  const { colors, typography } = panelStyles ?? {};

  const cssVars = buildCssVars({
    '--cs-text': colors?.text,
    '--cs-row-hover': colors?.rowHoverColor,
    '--cs-button-bg': colors?.collapsedButtonBg,
    '--cs-stage-text': colors?.stageTextColor,
    '--cs-failed-text': colors?.failedColor,
    '--cs-tag-text': colors?.tagTextColor,
    '--cs-count-text': colors?.countTextColor,
    '--cs-duration-text': colors?.durationTextColor,
    '--cs-icon-secondary': colors?.iconSecondaryColor,
    '--cs-icon-completed': colors?.iconCompletedColor,
    '--cs-icon-error': colors?.iconErrorColor,
    '--cs-code-bg': colors?.codeBg,
    '--cs-code-border': colors?.codeBorderColor,
    '--cs-code-text': colors?.codeTextColor,
    '--cs-border': colors?.borderColor,
  });

  const tree = useMemo(() => buildStageTree(stages), [stages]);

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'w-full min-w-0',
        styles.panel,
        className,
        CONVERSATION_STAGES_CLASS.panel,
      )}
    >
      <StageList
        nodes={tree}
        depth={0}
        className="w-full ps-5"
        isStreaming={isStreaming}
        expansion={expansion}
        typography={typography}
        labels={labels}
        onAttachmentClick={onAttachmentClick}
      />
    </div>
  );
};

/**
 * Inline list of agent stages, nested by `parent_stage_index`; repeated
 * identical names within one sibling list collapse into a ×N group row.
 */
export const StagesPanel: FC<StagesPanelProps> = (props) => {
  const expansion = useStageExpansion();
  return <StagesPanelView {...props} expansion={expansion} />;
};
