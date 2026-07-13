import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import QRCodeSvg from 'react-qr-code';

/** Props for {@link QrCode}. */
export interface QrCodeProps {
  /** The value encoded into the QR code (the share URL). */
  value: string;
  /** Accessible label describing the QR code image. */
  ariaLabel: string;
  /** CSS class applied to the outer frame. Defaults to `'flex size-40 items-center justify-center self-center rounded-lg border border-tertiary bg-layer-2 p-3'`. */
  containerClassName?: string;
  /** Color class driving the QR modules' fill via `currentColor`. Defaults to `'text-primary'`. */
  colorClassName?: string;
}

/** QR code rendering of the share link, scannable to open it on another device. */
export const QrCode: FC<QrCodeProps> = ({
  value,
  ariaLabel,
  containerClassName = 'flex size-40 items-center justify-center self-center rounded-lg border border-tertiary bg-layer-2 p-3',
  colorClassName = 'text-primary',
}) => (
  <div role="img" aria-label={ariaLabel} className={containerClassName}>
    <QRCodeSvg
      value={value}
      size={128}
      bgColor="transparent"
      fgColor="currentColor"
      aria-hidden
      className={mergeClasses('size-full', colorClassName)}
    />
  </div>
);
