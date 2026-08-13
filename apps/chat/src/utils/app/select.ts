import type { ButtonHTMLAttributes } from 'react';

/**
 * Adapts the `innerProps` react-select hands to a custom indicator or remove
 * component so they can be spread onto a real `<button>`.
 *
 * react-select assembles those props for a `<div>` rendered through its own
 * emotion factory, so next to the event handlers they carry an emotion `css`
 * object and the generated `className`. A plain button understands neither: the
 * `css` object ends up in the DOM as an attribute, and the class competes with
 * the ui-kit button styling. Both are dropped.
 */
export const getSelectButtonProps = (
  innerProps: object,
): ButtonHTMLAttributes<HTMLButtonElement> => {
  const {
    ref: __ref,
    css: __css,
    className: __className,
    ...buttonProps
  } = innerProps as Record<string, unknown>;

  return buttonProps as ButtonHTMLAttributes<HTMLButtonElement>;
};
