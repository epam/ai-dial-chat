import { lazy, Suspense, type FC } from 'react';
import type { PromptParametersPopupProps } from '../../models/prompt-parameters-popup-props';

// A separate build entry preserves the dynamic chunk in the published package.
const LazyPopup = lazy(async () => {
  const module = await import('../../entry-points/parameters-popup');
  return { default: module.PromptParametersPopup };
});

/** Compatible root export that loads the parameter UI only when opened. */
export const PromptParametersPopup: FC<PromptParametersPopupProps> = (
  props,
) => {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <LazyPopup {...props} />
    </Suspense>
  );
};
