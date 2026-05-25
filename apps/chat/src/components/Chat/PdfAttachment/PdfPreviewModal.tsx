import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Modal } from '@/src/components/Common/Modal';

import { PdfHighlightViewerLazy } from './PdfHighlightViewer.dynamic';

interface Props {
  url: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfPreviewModal = ({ url, title, isOpen, onClose }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={onClose}
      dataQa="pdf-preview-modal"
      containerClassName="flex flex-col w-full h-full max-w-[1200px] max-h-[95vh] p-3 md:p-4"
      heading={title || t(ChatI18nKeys.Attachment)}
      headingClassName="mb-3"
      showHeadingTooltip
    >
      <div className="min-h-0 grow overflow-hidden">
        <PdfHighlightViewerLazy url={url} />
      </div>
    </Modal>
  );
};
