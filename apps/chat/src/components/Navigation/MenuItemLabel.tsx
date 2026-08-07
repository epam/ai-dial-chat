import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { memo, type FC, type ReactNode } from 'react';

interface Props {
  label: string;
  isActive: boolean;
  icon?: ReactNode;
}

const MenuItemLabel: FC<Props> = ({ label, isActive, icon }) => (
  <span className="flex items-center justify-between gap-4">
    {icon ? (
      <span className="flex items-center gap-2">
        {icon}
        <span className="dial-small-text truncate text-primary">{label}</span>
      </span>
    ) : (
      <span className="dial-small-text truncate text-primary">{label}</span>
    )}
    {isActive && (
      <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden className="text-accent" />
    )}
  </span>
);

export default memo(MenuItemLabel);
