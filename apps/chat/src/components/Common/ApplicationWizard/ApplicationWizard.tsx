import { UseDismissProps } from '@floating-ui/react';
import React, { useCallback, useMemo } from 'react';

import { ApplicationType } from '@/src/types/applications';
import { ModalState } from '@/src/types/modal';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ApplicationWizardHeader } from '@/src/components/Common/ApplicationWizard/ApplicationWizardHeader';
import { CodeAppView } from '@/src/components/Common/ApplicationWizard/CodeAppView/CodeAppView';
import { CustomAppView } from '@/src/components/Common/ApplicationWizard/CustomAppView';
import { QuickAppView } from '@/src/components/Common/ApplicationWizard/QuickAppView';
import Modal from '@/src/components/Common/Modal';
import { Spinner } from '@/src/components/Common/Spinner';

const modalDismissProps = { outsidePressEvent: 'mousedown' } as UseDismissProps;
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
  const isLoading = useAppSelector(ApplicationSelectors.selectIsLoading);
  const selectedApplication = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const handleClose = useCallback(() => {
    onClose(false);
  }, [onClose]);

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

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="application-dialog"
      containerClassName="flex w-full flex-col pt-2 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px] !bg-layer-2"
      dismissProps={modalDismissProps}
      hideClose
    >
      {isLoading ? (
        <div className="flex size-full h-screen items-center justify-center">
          <Spinner size={48} dataQa="publication-items-spinner" />
        </div>
      ) : (
        <div className="relative flex max-h-full w-full grow flex-col divide-tertiary overflow-y-auto">
          <ApplicationWizardHeader
            onClose={onClose}
            type={type}
            isEdit={isEdit}
          />
          <View
            isOpen={isOpen}
            onClose={onClose}
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
