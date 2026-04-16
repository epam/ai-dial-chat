import { IconCheck, IconCopy } from '@tabler/icons-react';
import { FC, useMemo } from 'react';

import { useCopy } from '@/src/hooks/useCopy';

import { DialButtonProps } from '@epam/ai-dial-ui-kit/dist/src/components/Button/Button';

import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
} from '@epam/ai-dial-ui-kit';

interface CopyButtonProps extends Omit<DialButtonProps, 'onClick'> {
  copyContent: string;
  copyLabel: string;
  copiedLabel?: string;
}

export const CopyButton: FC<CopyButtonProps> = ({
  copyContent,
  copyLabel,
  copiedLabel,
  ...rest
}) => {
  const { onCopy, copied } = useCopy(copyContent);

  const { label, CopyIcon } = useMemo(
    () => ({
      label: copied ? copiedLabel : copyLabel,
      CopyIcon: copied ? IconCheck : IconCopy,
    }),
    [copied, copiedLabel, copyLabel],
  );

  return (
    <DialButton
      className="w-fit"
      variant={ButtonVariant.Neutral}
      appearance={ButtonAppearance.Outlined}
      {...rest}
      onClick={onCopy}
      label={label}
      iconBefore={<CopyIcon size={20} />}
    />
  );
};
