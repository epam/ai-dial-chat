/*
 * The ui kit's `Textarea` sets a 120px min-height but no upper bound, so a
 * user-resizable field can be dragged indefinitely — past the viewport and out
 * of the form around it. Cap it at half the viewport height; the kit already
 * gives `.dial-kit-textarea` `overflow: auto`, so the content scrolls from
 * there. Pass it as `Textarea`'s `className`.
 */
export const RESIZABLE_TEXTAREA_CLASS_NAME = 'max-h-[50vh]';

/*
 * The custom property `useAvailableHeightCap` writes the measured cap to, and
 * that `MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME` reads back. Kept next to the
 * class because the two have to name the same property: Tailwind only sees
 * class-name literals, so the name cannot be interpolated into the class.
 */
export const RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE =
  '--resizable-field-max-height';

/*
 * `MarkdownEditor` grows through `@uiw/react-md-editor`'s own drag bar, whose
 * ceiling is that package's 1200px default — taller than most viewports, and
 * not overridable through the kit's prop surface. Cap the inner editor box
 * instead, at the height still available below the field.
 *
 * Pass it as the `className` of the element carrying `useAvailableHeightCap`'s
 * ref, wrapped around the editor; custom properties inherit, so the cap reaches
 * the `.w-md-editor` box that carries the dragged height. The `70vh` fallback
 * only applies before the first measurement, or if the ref is left unattached.
 */
export const MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME =
  '[&_.w-md-editor]:max-h-[var(--resizable-field-max-height,70vh)]';
