/// <reference lib="dom" />

/** Copies `text` to the clipboard; returns `true` on success, `false` when both the Clipboard API and the `execCommand` fallback fail. */
export const copyToClipboard = (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    /*
     * Clipboard API must be called synchronously within the user-gesture
     * handler; do NOT await before calling it.
     */
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => execCommandFallback(text));
  }
  return Promise.resolve(execCommandFallback(text));
};

const execCommandFallback = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.innerText = text;
  // Keep it out of the viewport and non-interactive.
  textarea.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
  /*
   * iOS Safari requires the element NOT to be readonly for setSelectionRange
   * to work, but we prevent the keyboard from appearing with this trick.
   */
  textarea.setAttribute('autocomplete', 'off');
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    // `textarea.select()` is ignored on iOS Safari — use setSelectionRange.
    textarea.removeAttribute('readonly');
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};
