import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ApplicationType } from '@/src/types/applications';
import { ModalState } from '@/src/types/modal';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { MOUSE_OUTSIDE_PRESS_EVENT } from '@/src/constants/modal';

import { ApplicationWizardHeader } from '@/src/components/Common/ApplicationWizard/ApplicationWizardHeader';
import { CodeAppView } from '@/src/components/Common/ApplicationWizard/CodeAppView/CodeAppView';
import { CustomAppView } from '@/src/components/Common/ApplicationWizard/CustomAppView';
import { QuickAppView } from '@/src/components/Common/ApplicationWizard/QuickAppView';
import Modal from '@/src/components/Common/Modal';
import { Spinner } from '@/src/components/Common/Spinner';

import { UploadStatus } from '@epam/ai-dial-shared';

interface ApplicationWizardProps {
  isOpen: boolean;
  onClose: (value: boolean) => void;
  type: ApplicationType;
  isEdit?: boolean;
  currentReference?: string;
}

export const ApplicationWizard: React.FC<ApplicationWizardProps> = ({
  isOpen,
  onClose,
  type,
  isEdit,
  currentReference,
}) => {
  const [submitted, setSubmitted] = useState(false);

  const isLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const loadingStatus = useAppSelector(ApplicationSelectors.selectAppLoading);
  const selectedApplication = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const handleClose = useCallback(
    (result?: boolean) => {
      if (result) setSubmitted(true);
      else onClose(false);
    },
    [onClose],
  );

  const View = useMemo(() => {
    switch (type) {
      case ApplicationType.QUICK_APP:
        return QuickAppView;
      case ApplicationType.CODE_APP:
        return CodeAppView;
      case ApplicationType.CUSTOM_APP:
      default:
        return CustomAppView;
    }
  }, [type]);

  useEffect(() => {
    if (submitted && loadingStatus === UploadStatus.LOADED) {
      onClose(true);
      setSubmitted(false);
    } else if (submitted && loadingStatus === UploadStatus.FAILED) {
      setSubmitted(false);
    }
  }, [loadingStatus, submitted, onClose]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="application-dialog"
      containerClassName="flex w-full flex-col pt-2 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px] !bg-layer-2 relative"
      dismissProps={MOUSE_OUTSIDE_PRESS_EVENT}
      hideClose
    >
      {submitted && (
        <div className="absolute left-0 top-0 z-10 flex size-full items-center justify-center bg-layer-2">
          <Spinner size={48} dataQa="publication-items-spinner" />
        </div>
      )}
      {isLoading && !submitted ? (
        <div className="flex size-full h-screen items-center justify-center">
          <Spinner size={48} dataQa="publication-items-spinner" />
        </div>
      ) : (
        <div className="relative flex max-h-full w-full grow flex-col divide-tertiary overflow-y-auto">
          <ApplicationWizardHeader
            onClose={handleClose}
            type={type}
            isEdit={isEdit}
          />
          <View
            isOpen={isOpen}
            onClose={handleClose}
            type={type}
            isEdit={isEdit}
            currentReference={currentReference}
            selectedApplication={isEdit ? selectedApplication : undefined}
          />
        </div>
      )}
    </Modal>
  );
};
