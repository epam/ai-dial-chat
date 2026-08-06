import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import QRCodeSvg from 'react-qr-code';
import cssStyles from './QrCode.module.scss';

/** All user-visible strings in {@link QrCodeProps}. */
export interface QrCodeLabels {
  /** Accessible label describing the QR code image. */
  ariaLabel: string;
}

/** CSS custom-property color overrides for {@link QrCodeProps}. */
export interface QrCodeColors {
  /** Outer frame border color. */
  borderColor?: string;
  /** Outer frame background color. */
  backgroundColor?: string;
  /** QR modules' fill color (drives the SVG's `currentColor`). */
  fillColor?: string;
}

/** Typography/color utility-class overrides for {@link QrCodeProps}. */
export interface QrCodeStyles {
  /** Color overrides applied as CSS custom properties to the outer frame's border/background and the QR fill. */
  colors?: QrCodeColors;
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
  const { colors } = styles ?? {};

  const cssVars = buildCssVars({
    '--qr-border': colors?.borderColor,
    '--qr-bg': colors?.backgroundColor,
    '--qr-color': colors?.fillColor,
  });

  return (
    <div
      role="img"
      aria-label={labels.ariaLabel}
      style={cssVars}
      className={mergeClasses(
        'flex size-40 items-center justify-center self-center rounded-lg border p-3',
        cssStyles.container,
      )}
    >
      <QRCodeSvg
        value={value}
        size={128}
        bgColor="transparent"
        fgColor="currentColor"
        aria-hidden
        className={mergeClasses('size-full', cssStyles.qrColor)}
      />
    </div>
  );
};
