import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import QRCodeSvg from 'react-qr-code';

/** All user-visible strings in {@link QrCodeProps}. */
export interface QrCodeLabels {
  /** Accessible label describing the QR code image. */
  ariaLabel: string;
}

/** Typography/color utility-class overrides for {@link QrCodeProps}. */
export interface QrCodeStyles {
  /** CSS class applied to the outer frame. Defaults to `'flex size-40 items-center justify-center self-center rounded-lg border border-tertiary bg-layer-2 p-3'`. */
  containerClassName?: string;
  /** Color class driving the QR modules' fill via `currentColor`. Defaults to `'text-primary'`. */
  colorClassName?: string;
}

/** Props for {@link QrCode}. */
export interface QrCodeProps {
  /** The value encoded into the QR code (the share URL). */
  value: string;
  /** User-visible strings. */
  labels: QrCodeLabels;
  /** Typography/color utility-class overrides for the frame and QR fill. */
  styles?: QrCodeStyles;
}

/** QR code rendering of the share link, scannable to open it on another device. */
export const QrCode: FC<QrCodeProps> = ({ value, labels, styles }) => {
  const {
    containerClassName = 'flex size-40 items-center justify-center self-center rounded-lg border border-tertiary bg-layer-2 p-3',
    colorClassName = 'text-primary',
  } = styles ?? {};

  return (
    <div
      role="img"
      aria-label={labels.ariaLabel}
      className={containerClassName}
    >
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
};
