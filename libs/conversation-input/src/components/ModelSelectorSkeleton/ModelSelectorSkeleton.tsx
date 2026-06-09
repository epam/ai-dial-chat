import { DialSkeleton, DialSkeletonVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';

export const MODEL_SELECTOR_SKELETON_ROW_COUNT = 7;

interface ModelSelectorSkeletonIconProps {
  size?: number;
}

export const ModelSelectorSkeletonIcon: FC<ModelSelectorSkeletonIconProps> = ({
  size = 20,
}) => (
  <DialSkeleton
    variant={DialSkeletonVariant.Circular}
    width={size}
    height={size}
    active
  />
);

interface ModelSelectorSkeletonLabelProps {
  loadingLabel?: string;
}

export const ModelSelectorSkeletonLabel: FC<
  ModelSelectorSkeletonLabelProps
> = ({ loadingLabel }) => (
  <span className="flex min-w-0 flex-1 items-center">
    <DialSkeleton
      variant={DialSkeletonVariant.Text}
      width="100%"
      height={16}
      active
    />
    {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
  </span>
);

interface ModelSelectorSkeletonRowsProps {
  loadingLabel?: string;
}

export const ModelSelectorSkeletonRows: FC<ModelSelectorSkeletonRowsProps> = ({
  loadingLabel,
}) => (
  <div role="status" aria-label={loadingLabel}>
    {Array.from({ length: MODEL_SELECTOR_SKELETON_ROW_COUNT }).map(
      (_, index) => (
        <div
          key={index}
          className="flex h-11 items-center gap-3 px-4"
          aria-hidden="true"
        >
          <ModelSelectorSkeletonIcon />
          <ModelSelectorSkeletonLabel />
        </div>
      ),
    )}
  </div>
);
