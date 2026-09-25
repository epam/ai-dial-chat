import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowsMaximize } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import type { GroupedVisualizerCanvasContent } from '../../models/attachment-canvas';
import { VisualizerCanvasRenderer } from '../VisualizerCanvasRenderer/VisualizerCanvasRenderer';
import styles from './InlineGroupedVisualizer.module.scss';

/** Color overrides for `InlineGroupedVisualizer`, applied as CSS custom properties. */
export interface InlineGroupedVisualizerColors {
  /** Background of the frame. Defaults to `--bg-layer-2`. */
  background?: string;
  /** Border color of the frame and the header's bottom edge. Defaults to `--stroke-tertiary`. */
  border?: string;
  /** Text color of the header title. Defaults to `--text-primary`. */
  titleText?: string;
}

/** Props for the `InlineGroupedVisualizer` component. */
export interface InlineGroupedVisualizerProps {
  /** Grouped visualizer content to render. The same object should be handed to the canvas when `onExpand` fires. */
  content: GroupedVisualizerCanvasContent;
  /** Height of the iframe area in pixels, already resolved by the host from the registry entry's `height`/`mobileHeight`. */
  height: number;
  /** Called when the user activates the expand-to-canvas button. */
  onExpand: () => void;
  /** Accessible label for the expand-to-canvas button. */
  expandAriaLabel: string;
  /** Accessible name for the header's actions group. Defaults to `'Visualizer actions'`. */
  actionsGroupAriaLabel?: string;
  /** `title` attribute set on the visualizer iframe, naming it for assistive tech. Forwarded to `VisualizerCanvasRenderer`, which defaults it to the content's trimmed `visualizerName`. */
  frameTitle?: string;
  /** Text shown alongside the spinner while the handshake and data delivery are pending. Omitted by default (spinner only). */
  loadingLabel?: string;
  /** Message shown when the visualizer fails to receive its data. Defaults to `'Failed to load visualizer'`. */
  errorLabel?: string;
  /** CSS class applied to the header title. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
  /** Renders the frame without its border, rounded corners, background, and header divider. Defaults to `false`. */
  isBorderless?: boolean;
  /** Hides the header title text while keeping the header actions. Defaults to `false`. */
  isTitleHidden?: boolean;
  /** Color overrides applied as CSS custom properties. */
  colors?: InlineGroupedVisualizerColors;
}

const InlineGroupedVisualizerBase: FC<InlineGroupedVisualizerProps> = ({
  content,
  height,
  onExpand,
  expandAriaLabel,
  actionsGroupAriaLabel = 'Visualizer actions',
  frameTitle,
  loadingLabel,
  errorLabel,
  titleClassName = 'dial-small-semi-text',
  isBorderless = false,
  isTitleHidden = false,
  colors,
}) => {
  /* `visualizerName` is an opaque postMessage namespace, so it can legitimately
   * be whitespace — rendering that as a heading would leave a blank line, and
   * using it as the iframe's accessible name would leave the region unnamed. */
  const displayTitle = content.visualizerName.trim();
  const isTitleShown = !isTitleHidden && displayTitle !== '';

  return (
    <div
      className={mergeClasses(
        'flex w-full min-w-0 flex-col overflow-hidden',
        !isBorderless && ['rounded-xl border', styles.frame],
      )}
      style={buildCssVars({
        '--igv-bg': colors?.background,
        '--igv-border': colors?.border,
        '--igv-title-text': colors?.titleText,
      })}
    >
      {/*
       * Header strip styled after the MCP App inline preview's, which in turn
       * follows the Markdown renderer's code-block header: same min-height,
       * padding, bottom border, and small ghost icon button.
       */}
      <div
        className={mergeClasses(
          'flex min-h-10 items-center gap-2 py-2',
          isTitleShown ? 'justify-between' : 'justify-end',
          !isBorderless && ['border-b px-4', styles.header],
        )}
      >
        {isTitleShown && (
          <span
            className={mergeClasses(
              'min-w-0 truncate',
              titleClassName,
              styles.title,
            )}
          >
            {displayTitle}
          </span>
        )}
        <div
          role="toolbar"
          aria-label={actionsGroupAriaLabel}
          className="flex items-center gap-1"
        >
          <GhostIconButton
            icon={
              <IconArrowsMaximize
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            aria-label={expandAriaLabel}
            size={ElementSize.Small}
            onClick={onExpand}
          />
        </div>
      </div>
      {/* The accessible name lives on the connector-created iframe, which the
       * renderer titles — see its `frameTitle` prop. */}
      <div className="w-full" style={{ height: `${height}px` }}>
        <VisualizerCanvasRenderer
          content={content}
          loadingLabel={loadingLabel}
          errorLabel={errorLabel}
          frameTitle={frameTitle}
        />
      </div>
    </div>
  );
};

/** Renders a message's grouped visualizer inline in a framed container with an expand-to-canvas control. */
export const InlineGroupedVisualizer = memo(InlineGroupedVisualizerBase);
