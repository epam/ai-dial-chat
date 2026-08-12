import { Skeleton, SkeletonVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';

/** Number of skeleton rows rendered while deployments are loading. */
export const MODEL_SELECTOR_SKELETON_ROW_COUNT = 7;

interface ModelSelectorSkeletonIconProps {
  size?: number;
}

/** Circular skeleton placeholder for a deployment icon. */
export const ModelSelectorSkeletonIcon: FC<ModelSelectorSkeletonIconProps> = ({
  size = 20,
}) => (
  <Skeleton
    variant={SkeletonVariant.Circular}
    width={size}
    height={size}
    active
  />
);

interface ModelSelectorSkeletonLabelProps {
  loadingLabel?: string;
}

/** Text skeleton placeholder for a deployment label. */
export const ModelSelectorSkeletonLabel: FC<
  ModelSelectorSkeletonLabelProps
> = ({ loadingLabel }) => (
  <span className="flex min-w-0 flex-1 items-center">
    <Skeleton variant={SkeletonVariant.Text} width="100%" height={16} active />
    {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
  </span>
);

interface ModelSelectorSkeletonRowsProps {
  loadingLabel?: string;
}

/** Stacked skeleton rows shown while the model selector is loading. */
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
