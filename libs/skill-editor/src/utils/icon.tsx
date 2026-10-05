import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import type { TablerIcon } from '@tabler/icons-react';

/** Returns a decorative Tabler icon at the kit stroke, sized `DIAL_ICON_SIZE.MD` unless `size` is given. */
export const renderIcon = (
  Icon: TablerIcon,
  className?: string,
  size: number = DIAL_ICON_SIZE.MD,
) => (
  <Icon
    size={size}
    className={className}
    aria-hidden
    stroke={DIAL_KIT_ICON_STROKE}
  />
);
