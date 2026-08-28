import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  NeutralButton,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { FC, ReactNode } from 'react';

export interface CopyButtonProps {
  onClick: () => void;
  className?: string;
  isCopied: boolean;
  copyLabel: string;
  copiedLabel: string;
  size?: ElementSize;
  /** Accessible label for the button; falls back to `copyLabel` when omitted. */
  ariaLabel?: string;
  iconSize?: number;
  iconCopy?: ReactNode;
}
export const CopyIconButton: FC<CopyButtonProps> = ({
  onClick,
  isCopied,
  copyLabel,
  copiedLabel,
  size = ElementSize.Standard,
  ariaLabel,
  iconSize = DIAL_ICON_SIZE.LG,
  iconCopy,
}) => {
  return (
    <ToggleIconButton
      size={size}
      icon={
        isCopied ? (
          <IconCheck
            size={iconSize}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        ) : (
          (iconCopy ?? (
            <IconCopy
              size={iconSize}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          ))
        )
      }
      aria-label={isCopied ? copiedLabel : (ariaLabel ?? copyLabel)}
      tooltipProps={{
        tooltip: isCopied ? copiedLabel : copyLabel,
      }}
      onClick={onClick}
    />
  );
};

export const CopyButton: FC<CopyButtonProps> = ({
  onClick,
  isCopied,
  copyLabel,
  copiedLabel,
  size = ElementSize.Standard,
}) => {
  return (
    <NeutralButton
      size={size}
      label={isCopied ? copiedLabel : copyLabel}
      iconBefore={
        isCopied ? (
          <IconCheck
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ) : (
          <IconCopy
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        )
      }
      onClick={onClick}
      className="shrink-0"
    />
  );
};
