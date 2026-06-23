import { memo, useCallback, type FC } from 'react';
import { useAttachmentCanvas } from '../../context/AttachmentCanvasContext';
import { downloadAttachmentContent } from '../../utils/download';
import { AttachmentCanvas } from '../AttachmentCanvas/AttachmentCanvas';

/** Props for the AttachmentCanvasContainer component. */
export interface AttachmentCanvasContainerProps {
  /** Accessible label for the panel region. Defaults to `'Attachment preview'`. */
  ariaLabel?: string;
  /** Accessible label for the close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Accessible label for the download button. Defaults to `'Download'`. */
  downloadLabel?: string;
  /** Message shown when the content type is `Unsupported`. Defaults to `'Preview is not supported for this file'`. */
  unsupportedLabel?: string;
  /** Whether the viewport is in mobile breakpoint — disables drag-to-resize. Defaults to `false`. */
  isMobile?: boolean;
}

/** Context-connected container that renders `AttachmentCanvas` with download support. */
export const AttachmentCanvasContainer: FC<AttachmentCanvasContainerProps> =
  memo(
    ({
      ariaLabel = 'Attachment preview',
      closeLabel = 'Close',
      downloadLabel = 'Download',
      unsupportedLabel = 'Preview is not supported for this file',
      isMobile = false,
    }) => {
      const { isOpen, content, fileName, closeCanvas } = useAttachmentCanvas();

      const handleDownload = useCallback(() => {
        downloadAttachmentContent(content, fileName);
      }, [content, fileName]);

      return (
        <AttachmentCanvas
          isOpen={isOpen}
          onClose={closeCanvas}
          content={content}
          fileName={fileName}
          ariaLabel={ariaLabel}
          closeLabel={closeLabel}
          onDownload={handleDownload}
          downloadLabel={downloadLabel}
          unsupportedLabel={unsupportedLabel}
          isMobile={isMobile}
        />
      );
    },
  );
