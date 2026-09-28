import {
  copyToClipboard,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy, IconDownload } from '@tabler/icons-react';
import { type FC, useEffect, useRef, useState } from 'react';
import {
  canWriteImageToClipboard,
  createQrPngBlob,
  writeQrImageToClipboard,
} from '../../utils/qr-image';

/* Matches `useCodeCopy`'s reset delay, so both copy confirmations last equally long. */
const COPIED_RESET_DELAY_MS = 2000;

/** Props for {@link QrActions}. */
interface QrActionsProps {
  /** The share URL, copied as text when the image cannot be. */
  url: string;
  /** Returns the rendered QR `<svg>`, or `null` before it has mounted. */
  getSvg: () => SVGSVGElement | null;
  /** Copy button default label. */
  copyLabel: string;
  /** Copy button label after copying, also announced to screen readers. */
  copiedLabel: string;
  /** Download button label. */
  downloadLabel: string;
  /** File name for the downloaded PNG. */
  downloadFileName: string;
}

/** Copy-as-image and download-as-PNG actions shown under the share popover's QR code. */
export const QrActions: FC<QrActionsProps> = ({
  url,
  getSvg,
  copyLabel,
  copiedLabel,
  downloadLabel,
  downloadFileName,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showCopied = () => {
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    setIsCopied(true);
    timeoutRef.current = setTimeout(
      () => setIsCopied(false),
      COPIED_RESET_DELAY_MS,
    );
  };

  const copyQrImage = async (): Promise<boolean> => {
    const svg = getSvg();
    if (svg == null || !canWriteImageToClipboard()) return false;
    try {
      /* Called before any await, so the write still counts as part of the click. */
      await writeQrImageToClipboard(svg);
      return true;
    } catch {
      return false;
    }
  };

  /*
   * The image is what the user asked for; the link text is the fallback when
   * the browser cannot put an image on the clipboard or refuses the write.
   */
  const handleCopy = async () => {
    try {
      const isSuccess = (await copyQrImage()) || (await copyToClipboard(url));
      if (isSuccess) showCopied();
    } catch {
      /* Both copy paths failed — the button keeps its default state. */
    }
  };

  const handleDownload = async () => {
    const svg = getSvg();
    if (svg == null) return;
    try {
      triggerBlobDownload(await createQrPngBlob(svg), downloadFileName);
    } catch {
      /* Nothing to download — the popover stays usable; the lib has no notification channel. */
    }
  };

  return (
    <>
      <div className="flex items-center justify-center gap-4 self-center">
        <GhostButton
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
          onClick={() => void handleCopy()}
        />
        <GhostButton
          label={downloadLabel}
          iconBefore={
            <IconDownload
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          onClick={() => void handleDownload()}
        />
      </div>
      {/* Screen-reader-only announcement: the label change is visual-only. */}
      <span role="status" aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </>
  );
};
