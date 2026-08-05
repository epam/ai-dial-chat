import {
  DIAL_ICON_SIZE,
  ElementSize,
  GhostIconButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { FC } from 'react';

export interface CopyButtonProps {
  onClick: () => void;
  className?: string;
  isCopied: boolean;
  copyLabel: string;
  copiedLabel: string;
  size?: ElementSize;
  /** Accessible label for the button; falls back to `copyLabel` when omitted. */
  ariaLabel?: string;
}
export const CopyIconButton: FC<CopyButtonProps> = ({
  onClick,
  isCopied,
  copyLabel,
  copiedLabel,
  size = ElementSize.Standard,
  ariaLabel,
}) => {
  return (
    <GhostIconButton
      size={size}
      icon={
        isCopied ? (
          <IconCheck size={DIAL_ICON_SIZE.LG} stroke={1.5} aria-hidden />
        ) : (
          <IconCopy size={DIAL_ICON_SIZE.LG} stroke={1.5} aria-hidden />
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
          <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
        ) : (
          <IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />
        )
      }
      onClick={onClick}
      className="shrink-0"
    />
  );
};
