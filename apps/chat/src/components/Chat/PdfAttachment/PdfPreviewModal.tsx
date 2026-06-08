import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Modal } from '@/src/components/Common/Modal';

import { PdfHighlightViewerLazy } from './PdfHighlightViewer.dynamic';

import {
  MessageAnnotation,
  MessageAnnotationSelector,
  MessageAnnotationSelectorType,
} from '@epam/ai-dial-shared';
import { InputHighlightData } from '@epam/pdf-highlighter-kit';

interface Props {
  url: string;
  title?: string;
  onClose: () => void;
  annotations?: MessageAnnotation[];
}

export const PdfPreviewModal = ({
  url,
  title,
  onClose,
  annotations,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const highlightData: InputHighlightData[] = useMemo(
    () =>
      (annotations ?? [])
        .filter(
          ({ target }) =>
            target?.selector?.type === MessageAnnotationSelectorType.PdfRegion,
        )
        .map((annotation) => {
          const selector = annotation.target.selector as Extract<
            MessageAnnotationSelector,
            { type: MessageAnnotationSelectorType.PdfRegion }
          >;

          return {
            id: 'index-' + annotation.index,
            label: annotation.body.title,
            bboxes: [
              {
                page: selector.page,
                x1: selector.bbox.left,
                x2: selector.bbox.left + selector.bbox.width,
                y1: selector.bbox.top,
                y2: selector.bbox.top + selector.bbox.height,
              },
            ],
            style: {
              backgroundColor: '#FFD166',
              opacity: 0.35,
              borderColor: '#D99A00',
              borderWidth: '1px',
              borderRadius: '4px',
            },
            labelStyle: {
              fontSize: 11,
              color: '#1F2933',
              fontWeight: 600,
            },
          };
        }),
    [annotations],
  );

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
      <div className="min-h-0 grow overflow-hidden" data-no-context-menu>
        <PdfHighlightViewerLazy url={url} highlights={highlightData} />
      </div>
    </Modal>
  );
};
