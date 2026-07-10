import { IconQrcode } from '@tabler/icons-react';
import { FC } from 'react';

/** Props for {@link QrPlaceholder}. */
interface QrPlaceholderProps {
  /** The value the QR code will encode once a real generator is wired in. */
  value: string;
  /** Accessible label describing the placeholder. */
  ariaLabel: string;
}

/**
 * Placeholder for the share-link QR code — no QR-generation library is wired
 * in yet. Swap this component's body for a real QR renderer keyed on `value`
 * without touching the popover around it (`SharePopover` only depends on
 * this component's props, not its internals).
 */
export const QrPlaceholder: FC<QrPlaceholderProps> = ({ value, ariaLabel }) => (
  <div
    role="img"
    aria-label={ariaLabel}
    title={value}
    className="flex size-40 items-center justify-center self-center rounded-lg border border-tertiary bg-layer-2"
  >
    <IconQrcode size={64} className="text-tertiary" aria-hidden />
  </div>
);
