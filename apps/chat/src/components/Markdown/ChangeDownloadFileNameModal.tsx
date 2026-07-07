import { KeyboardEvent, useEffect, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys, MarkdownI18nKeys } from '@/src/constants/i18n';
import { DISALLOW_INTERACTIONS } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

import {
  DialInput,
  DialNeutralButton,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  defaultFilename: string;
  heading: string;
  onConfirm: (filename: string) => void;
  onClose: () => void;
  dataQa?: string;
}

export const ChangeDownloadFileNameModal = ({
  isOpen,
  defaultFilename,
  heading,
  onConfirm,
  onClose,
  dataQa = 'change-download-filename-modal',
}: Props) => {
  const { t: tCommon } = useTranslation(Translation.Common);
  const { t } = useTranslation(Translation.Markdown);
  const [filename, setFilename] = useState(defaultFilename);

  useEffect(() => {
    if (isOpen) {
      setFilename(defaultFilename);
    }
  }, [isOpen, defaultFilename]);

  const handleConfirm = () => {
    if (filename.trim()) {
      onConfirm(filename.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      dataQa={dataQa}
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 md:min-w-[300px] md:max-w-[500px]"
      dismissProps={DISALLOW_INTERACTIONS}
      hideClose
      heading={heading}
    >
      <div className="flex flex-col gap-4">
        <DialInput
          value={filename}
          onChange={(value) => setFilename(value ?? '')}
          onKeyDown={handleKeyDown}
          data-qa="download-filename-input"
        />
        <div className="flex w-full items-center justify-end gap-3">
          <DialNeutralButton
            data-no-context-menu
            label={tCommon(CommonI18nKeys.Cancel)}
            onClick={onClose}
            data-qa="cancel-dialog"
          />
          <DialPrimaryButton
            data-no-context-menu
            autoFocus
            label={t(MarkdownI18nKeys.Download)}
            onClick={handleConfirm}
            data-qa="confirm"
          />
        </div>
      </div>
    </Modal>
  );
};
