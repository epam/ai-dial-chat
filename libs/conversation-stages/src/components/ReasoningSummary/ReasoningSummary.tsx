import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { LinkButton } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { FC, useId, useState } from 'react';
import type { ReasoningSummaryProps } from '../../models/reasoning-summary';
import { StageMarkdownContent } from '../StageMarkdownContent/StageMarkdownContent';
import styles from './ReasoningSummary.module.scss';

/** Collapsible section rendering accumulated reasoning-summary text, kept visually and semantically separate from executed stages. */
export const ReasoningSummary: FC<ReasoningSummaryProps> = ({
  text,
  isStreaming = false,
  labels,
  className,
  styles: summaryStyles,
}) => {
  const {
    title = 'Reasoning summary',
    expandAriaLabel = 'Expand reasoning summary',
    collapseAriaLabel = 'Collapse reasoning summary',
    copyAriaLabel,
  } = labels ?? {};
  const [isOpen, setIsOpen] = useState(isStreaming);
  const contentId = useId();
  const { colors, typography } = summaryStyles ?? {};
  const cssVars = buildCssVars({
    '--cs-rs-label': colors?.labelColor,
    '--cs-rs-label-hover': colors?.labelHoverColor,
  });

  if (!text) return null;

  return (
    <div
      style={cssVars}
      className={mergeClasses('flex w-full flex-col gap-1', className)}
    >
      <LinkButton
        className={styles.toggleButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-label={isOpen ? collapseAriaLabel : expandAriaLabel}
        iconAfter={
          isOpen ? (
            <IconChevronDown size={12} aria-hidden />
          ) : (
            <IconChevronRight
              size={12}
              className="rtl:scale-x-[-1]"
              aria-hidden
            />
          )
        }
        label={
          <span
            className={mergeClasses(
              typography?.fontClassName ?? 'dial-small-text',
            )}
          >
            {title}
          </span>
        }
      />
      <div
        id={contentId}
        className={mergeClasses(
          'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="false"
            className="pt-1"
          >
            <StageMarkdownContent
              content={text}
              typography={typography}
              copyAriaLabel={copyAriaLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
