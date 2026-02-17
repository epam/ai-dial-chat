import { IconX } from '@tabler/icons-react';

import { DialIconButtonProps } from '@epam/ai-dial-ui-kit/dist/src/components/IconButton/IconButton';

import { ButtonSize, DialGhostIconButton } from '@epam/ai-dial-ui-kit';

interface CloseButtonProps
  extends Omit<DialIconButtonProps, 'appearance' | 'icon' | 'size'> {
  iconClassName?: string;
  iconSize?: number;
}

export function CloseButton({
  iconClassName,
  iconSize = 24,
  ...props
}: CloseButtonProps) {
  return (
    <DialGhostIconButton
      {...props}
      icon={<IconX className={iconClassName} size={iconSize} stroke={1.5} />}
    />
  );
}

export function CloseButtonSmall({
  iconClassName,
  iconSize = 16,
  ...props
}: CloseButtonProps) {
  return (
    <DialGhostIconButton
      {...props}
      size={ButtonSize.Small}
      icon={<IconX className={iconClassName} size={iconSize} stroke={1.5} />}
    />
  );
}
