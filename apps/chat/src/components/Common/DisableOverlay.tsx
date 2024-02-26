/**
 * This component needs to be wrapped with component with position: relative.
 *
 * Creates transparent overlay in full size of the parent container
 */
export const DisableOverlay = () => (
  <div className="absolute z-10 size-full cursor-not-allowed bg-transparent"></div>
);
