import { useTranslation } from 'next-i18next';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ModalState } from '@/src/types/modal';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Modal } from '@/src/components/Common/Modal';
import { ToolsetLoginForm } from '@/src/components/ToolsetEditor/ToolsetLoginForm';

interface ToolsetLoginDialogProps {
  entity: ToolsetModel;
  onClose: () => void;
}

export const ToolsetLoginDialog = ({
  entity,
  onClose,
}: ToolsetLoginDialogProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isSignedIn = entity && isToolsetSignedIn(entity);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-toolset-signin"
      containerClassName="flex flex-col gap-4 w-full xl:max-w-[450px] p-6"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold leading-6 text-primary">
          {t(isSignedIn ? 'Logout' : 'Login')}: {entity.name}
        </h3>
        <h4 className="text-sm font-normal leading-5 text-primary">
          {t('Version')}: {entity.version}
        </h4>
      </div>

      <ToolsetLoginForm
        type={entity.authSettings.authenticationType}
        toolset={entity}
        buttonClassName="ml-auto"
      />
    </Modal>
  );
};
