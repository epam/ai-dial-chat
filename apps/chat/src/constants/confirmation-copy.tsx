/*
 * Shared by every catalog confirmation sentence that names the resource it is
 * about. The tag name here has to match the one inside the translated strings
 * (`<bold>{{name}}</bold>`); a mismatch renders the sentence with the name
 * unemphasised instead of failing, so the pairing is covered by
 * `tests/confirmation-copy.spec.tsx`, which covers every key that carries the tag.
 *
 * Declared once rather than inline at each call site, which also keeps the
 * element out of the details-texts memo's dependency-free rebuild path.
 */
export const CONFIRMATION_BOLD_COMPONENTS = {
  /* Semibold partner of the confirmation copy's own `dial-small-text`. */
  bold: <strong className="dial-small-semi-text" />,
};
