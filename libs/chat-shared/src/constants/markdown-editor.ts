/*
 * Tailwind's preflight zeroes `list-style` on every `ul`/`ol`, and
 * `@uiw/react-markdown-preview`'s stylesheet only re-declares
 * `list-style-type` for *nested* lists — it leaves top-level ones on the
 * browser default that preflight just removed. The result is a preview where
 * bullets and numbers are missing entirely. Restore the markers the preview
 * expects: `disc`/`circle`/`square` down the `ul` nesting chain, and `decimal`
 * for a top-level `ol` only, so the vendor's `lower-roman`/`lower-alpha` rules
 * for deeper ordered lists still win. Pass it as the `className` of
 * `MarkdownEditor` or of any element wrapping it — the class only has to sit on
 * an ancestor of the `.wmde-markdown` preview.
 */
export const MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME =
  '[&_.wmde-markdown>ol]:list-decimal [&_.wmde-markdown_ul]:list-disc [&_.wmde-markdown_ul_ul]:list-[circle] [&_.wmde-markdown_ul_ul_ul]:list-[square]';
