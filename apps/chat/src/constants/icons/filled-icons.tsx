import type { FC, SVGProps } from 'react';
import ClockHour3FilledSvg from './clock-hour-3-filled.svg?react';
import FolderOpenFilledSvg from './folder-open-filled.svg?react';
import LayoutGridFilledSvg from './layout-grid-filled.svg?react';
import MessageCircleFilledSvg from './message-circle-filled.svg?react';

interface FilledIconProps {
  size?: number;
  /** Accepted for Tabler signature parity; filled glyphs have no stroke. */
  stroke?: number;
}

/*
 * Tabler's `*Filled` glyphs are drawn for its 2px outline set, so next to our
 * 1.5px outline icons they read as a different shape. These custom glyphs
 * (DIAL Foundations 2.0) match the 1.5px silhouettes and paint with
 * `currentColor`, which lets the navigation lib's selected-state fill apply.
 */
const createFilledIcon = (Svg: FC<SVGProps<SVGSVGElement>>) => {
  const FilledIcon: FC<FilledIconProps> = ({ size = 24 }) => (
    <Svg width={size} height={size} aria-hidden="true" focusable="false" />
  );
  return FilledIcon;
};

export const IconClockHour3CustomFilled = createFilledIcon(ClockHour3FilledSvg);
export const IconFolderOpenCustomFilled = createFilledIcon(FolderOpenFilledSvg);
export const IconLayoutGridCustomFilled = createFilledIcon(LayoutGridFilledSvg);
export const IconMessageCircleCustomFilled = createFilledIcon(
  MessageCircleFilledSvg,
);
