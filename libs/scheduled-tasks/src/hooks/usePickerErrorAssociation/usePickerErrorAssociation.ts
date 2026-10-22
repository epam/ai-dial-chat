import { useId, useLayoutEffect } from 'react';

/*
 * The kit `Calendar` applies its `id` to the picker control but exposes no
 * `aria-describedby` prop, so a submit-time error's association with the
 * control is bridged by hand — the same hand-bridge pattern
 * `SkillSelectorField` builds for the kit `Select`.
 */
/** Associates a picker's submit-time error text with its control through `aria-describedby`, and returns the id the error paragraph must carry. Render the paragraph with `role="alert"` so the message is announced when it appears. */
export const usePickerErrorAssociation = (
  pickerId: string,
  error: string | undefined,
): string => {
  const errorId = useId();

  useLayoutEffect(() => {
    const control = document.getElementById(pickerId);
    if (!control) {
      return;
    }
    if (error) {
      control.setAttribute('aria-describedby', errorId);
    } else {
      control.removeAttribute('aria-describedby');
    }
  }, [error, errorId, pickerId]);

  return errorId;
};
