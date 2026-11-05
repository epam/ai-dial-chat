import { buildCssVars } from '@epam/ai-dial-chat-shared';
import type { CSSProperties } from 'react';
import type { InputProps } from '../../models/Input';

/**
 * Maps `Input`'s `colors` prop to the `--ci-*` CSS variables its stylesheet
 * and child components read. Private to `Input`.
 */
export const buildInputCssVars = (
  colors: InputProps['colors'],
): CSSProperties =>
  buildCssVars({
    '--ci-bg': colors?.background,
    '--ci-text': colors?.text,
    '--ci-border': colors?.border,
    '--ci-border-focus': colors?.borderFocus,
    '--ci-placeholder': colors?.placeholder,
    '--ci-text-disabled': colors?.textDisabled,
    '--ci-model-selector-caret-color': colors?.modelSelectorCaret,
    '--ci-model-selector-hover-bg': colors?.modelSelectorHoverBg,
    '--ci-model-selector-disabled-color': colors?.modelSelectorDisabled,
    '--ci-model-selector-name-color': colors?.modelSelectorName,
    '--ci-model-selector-version-color': colors?.modelSelectorVersion,
    '--ci-voice-waveform': colors?.voiceWaveform,
    '--ci-voice-accent': colors?.voiceAccent,
    '--ci-mention-highlight-bg': colors?.mentionHighlightBg,
    '--ci-mention-highlight-text': colors?.mentionHighlightText,
    '--ci-mention-highlight-unsupported-bg':
      colors?.mentionHighlightUnsupportedBg,
    '--ci-mention-highlight-unsupported-text':
      colors?.mentionHighlightUnsupportedText,
    '--ci-selection-highlight-bg': colors?.selectionHighlightBg,
  });
