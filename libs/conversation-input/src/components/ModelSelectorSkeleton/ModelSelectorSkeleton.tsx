import {
  buildCssVars,
  mergeClasses,
  SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import { LiveRegion, Skeleton, SkeletonVariant } from '@epam/ai-dial-ui-kit';
import { type FC, useEffect, useState } from 'react';
import styles from './ModelSelectorSkeleton.module.scss';

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
    color={styles.skeletonColor}
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
    <Skeleton
      variant={SkeletonVariant.Text}
      width="100%"
      height={16}
      color={styles.skeletonColor}
      active
    />
    {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
  </span>
);

/**
 * Stacked, `aria-hidden` skeleton rows shown while the model selector is
 * loading. The parent announces the loading text through its own
 * always-mounted live region.
 */
export const ModelSelectorSkeletonRows: FC = () => (
  <div aria-hidden="true">
    {Array.from({ length: MODEL_SELECTOR_SKELETON_ROW_COUNT }).map(
      (_, index) => (
        <div key={index} className="flex h-11 items-center gap-3 px-4">
          <ModelSelectorSkeletonIcon />
          <ModelSelectorSkeletonLabel />
        </div>
      ),
    )}
  </div>
);

/** Name-bar widths of the list rows in the design, in order; `100%` fills the row. */
const PANEL_ROW_WIDTHS: readonly (number | string)[] = [
  '100%',
  235,
  214,
  '100%',
];

interface ModelSelectorPanelSkeletonRowProps {
  /** Width of the name bar. */
  width: number | string;
}

const ModelSelectorPanelSkeletonRow: FC<ModelSelectorPanelSkeletonRowProps> = ({
  width,
}) => (
  <div className="flex items-center gap-4 py-2.5">
    <Skeleton
      color={styles.skeletonColor}
      variant={SkeletonVariant.Circular}
      width={28}
      height={28}
      active
    />
    <div className="flex min-w-0 flex-1">
      <Skeleton
        color={styles.skeletonColor}
        variant={SkeletonVariant.Text}
        width={width}
        height={20}
        active
      />
    </div>
  </div>
);

/** Props for {@link ModelSelectorPanelSkeleton}. */
export interface ModelSelectorPanelSkeletonProps {
  /** Text announced to assistive tech while the panel is a skeleton. */
  loadingLabel?: string;
  /** Shimmer color of every bar. Defaults to `--ci-skeleton-color`, then `--bg-control-disable-primary`. */
  skeletonColor?: string;
}

/**
 * Placeholder for the whole model picker panel (search, selected row,
 * favourites, footer) shown while deployments load. Its options box is
 * capped at the same height as the loaded list.
 */
export const ModelSelectorPanelSkeleton: FC<
  ModelSelectorPanelSkeletonProps
> = ({ loadingLabel, skeletonColor }) => {
  /*
   * The skeleton only exists while loading, so its live region would mount
   * together with its text and be read late or not at all. Mounting it empty
   * and filling it after the first commit makes it announce.
   */
  const [announcedLabel, setAnnouncedLabel] = useState<string>();
  useEffect(() => {
    setAnnouncedLabel(loadingLabel);
  }, [loadingLabel]);

  return (
    <div
      className="flex w-full flex-col gap-3 p-3"
      style={buildCssVars({ '--ci-skeleton-color': skeletonColor })}
    >
      <LiveRegion visuallyHidden>{announcedLabel}</LiveRegion>
      <div aria-hidden>
        <Skeleton
          color={styles.skeletonColor}
          variant={SkeletonVariant.Text}
          width="100%"
          height={20}
          active
        />
      </div>
      {/* The options box carries the same cap as the loaded list, so the two never differ in height. */}
      <div
        aria-hidden
        className={mergeClasses(
          SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
          'flex flex-col gap-3 overflow-hidden',
        )}
      >
        <div className="flex flex-col">
          <div className="py-1.5">
            <Skeleton
              color={styles.skeletonColor}
              variant={SkeletonVariant.Text}
              width={144}
              height={16}
              active
            />
          </div>
          <ModelSelectorPanelSkeletonRow width={214} />
        </div>
        <div className="flex flex-col">
          <div className="py-1.5">
            <Skeleton
              color={styles.skeletonColor}
              variant={SkeletonVariant.Text}
              width={144}
              height={20}
              active
            />
          </div>
          {PANEL_ROW_WIDTHS.map((width, index) => (
            <ModelSelectorPanelSkeletonRow key={index} width={width} />
          ))}
        </div>
      </div>
      <div aria-hidden className="flex justify-center">
        <Skeleton
          color={styles.skeletonColor}
          variant={SkeletonVariant.Rectangular}
          width={296}
          height={40}
          active
        />
      </div>
    </div>
  );
};
