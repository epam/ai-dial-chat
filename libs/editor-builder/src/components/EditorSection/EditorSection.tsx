import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import type { EditorSectionProps } from '../../models/editor-section-props';
import styles from './EditorSection.module.scss';

/** Bordered card wrapper for a named section inside an editor layout. */
export const EditorSection: FC<EditorSectionProps> = ({
  title,
  children,
  styles: stylesProp,
  className,
}) => {
  const cssVars = buildCssVars({
    '--es-border-color': stylesProp?.colors?.borderColor,
    '--es-title-color': stylesProp?.colors?.titleColor,
  });

  return (
    <section
      className={mergeClasses(
        'flex flex-col gap-4 rounded border p-6',
        styles.section,
        className,
      )}
      style={cssVars}
    >
      {title != null && (
        <h2 className={mergeClasses('dial-h3-text', styles.title)}>{title}</h2>
      )}
      {children}
    </section>
  );
};
