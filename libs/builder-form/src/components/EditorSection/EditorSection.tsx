import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { useId, type FC } from 'react';
import { BUILDER_FORM_CLASS } from '../../constants/public-class-names';
import type { EditorSectionProps } from '../../models/editor-section-props';
import styles from './EditorSection.module.scss';

/** Bordered card wrapper for a named section inside an editor layout. */
export const EditorSection: FC<EditorSectionProps> = ({
  title,
  children,
  styles: stylesProp,
  className,
}) => {
  /* The heading names the section, so it reads as a named region. */
  const titleId = useId();
  const cssVars = buildCssVars({
    '--es-border-color': stylesProp?.colors?.borderColor,
    '--es-title-color': stylesProp?.colors?.titleColor,
  });

  return (
    <section
      aria-labelledby={title != null ? titleId : undefined}
      className={mergeClasses(
        'flex h-full flex-col gap-4 rounded border',
        styles.section,
        className,
        BUILDER_FORM_CLASS.section,
      )}
      style={cssVars}
    >
      {title != null && (
        <h2
          id={titleId}
          className={mergeClasses(
            stylesProp?.typography?.titleClassName ?? 'dial-h3-text',
            styles.title,
          )}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
};
