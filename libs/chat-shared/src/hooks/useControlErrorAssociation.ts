import { useLayoutEffect } from 'react';

/*
 * Bridges a field error to a control that exposes no `aria-describedby` /
 * `aria-invalid` prop (the kit `MarkdownEditor` and `Calendar`, or a
 * host-composed selector). The effect runs after every render because a
 * lazily loaded control can mount or remount independently of the error
 * changing; ids other than `errorId` already on the control are kept.
 */
/** Adds `errorId` to the `aria-describedby` of the element `getControl` returns and sets `aria-invalid` while `hasError` is true. */
export const useControlErrorAssociation = (
  getControl: () => Element | null,
  errorId: string,
  hasError: boolean,
): void => {
  useLayoutEffect(() => {
    const control = getControl();
    if (!control) {
      return;
    }
    const describedBy = (control.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id !== '' && id !== errorId);
    if (hasError) {
      describedBy.push(errorId);
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-invalid');
    }
    if (describedBy.length > 0) {
      control.setAttribute('aria-describedby', describedBy.join(' '));
    } else {
      control.removeAttribute('aria-describedby');
    }
  });
};
