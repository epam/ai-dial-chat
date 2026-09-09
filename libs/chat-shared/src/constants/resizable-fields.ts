/*
 * The ui kit's `Textarea` sets a 120px min-height but no upper bound, so a
 * user-resizable field can be dragged indefinitely — past the viewport and out
 * of the form around it. Cap it at half the viewport height; the kit already
 * gives `.dial-kit-textarea` `overflow: auto`, so the content scrolls from
 * there. Pass it as `Textarea`'s `className`.
 */
export const RESIZABLE_TEXTAREA_CLASS_NAME = 'max-h-[50vh]';

/*
 * `MarkdownEditor` grows through `@uiw/react-md-editor`'s own drag bar, whose
 * ceiling is that package's 1200px default — taller than most viewports, and
 * not overridable through the kit's prop surface. Cap the inner editor box
 * instead so the drag stops at the viewport edge. Pass it as `MarkdownEditor`'s
 * `className`; the class it lands on wraps the `.w-md-editor` box that carries
 * the dragged height.
 */
export const MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME =
  '[&_.w-md-editor]:max-h-[70vh]';
