import { useCallback, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FormValidations, getFieldClassnames } from '@/src/utils/app/forms';

import { DialLink } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS } from '@/src/constants/modal';

import { FieldErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { Modal } from '@/src/components/Common/Modal';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props {
  onClose: (link?: DialLink) => void;
}

interface Inputs {
  href: string;
  title?: string;
}

export const AttachLinkDialog = ({ onClose }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const {
    register,
    handleSubmit: submitWrapper,
    setFocus,
    formState: { errors, isValid, dirtyFields, touchedFields },
  } = useForm<Inputs>({ mode: 'all' });

  const handleSubmit: SubmitHandler<Inputs> = (data) => {
    if (isValid) {
      const link: DialLink = {
        title: data.title,
        href: data.href,
      };
      onClose(link);
    }
  };

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    setFocus('href');
  }, [setFocus]);

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={handleClose}
      dataQa="attach-link-dialog"
      overlayClassName="fixed inset-0"
      containerClassName="inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-w-[720px] 2xl:max-w-[780px]"
      heading={t(ChatI18nKeys.AttachLink)}
      dismissProps={OUTSIDE_PRESS}
    >
      <form onSubmit={submitWrapper(handleSubmit)}>
        <div className="mb-4">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="addressNameInput"
          >
            {t(ChatI18nKeys.Address)}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <input
            title=""
            placeholder={t(ChatI18nKeys.PasteLink)}
            type="url"
            className={getFieldClassnames<Inputs>('href', 'input', {
              errors,
              dirtyFields,
              touchedFields,
            })}
            {...register('href', {
              validate: {
                notEmpty: FormValidations.notEmpty,
                checkUrl: FormValidations.checkUrl,
              },
            })}
          />

          <FieldErrorMessage error={errors.href?.message} className="mb-4" />
        </div>

        <div className="mb-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="titleInput"
          >
            {t(ChatI18nKeys.Title)}
          </label>
          <input
            title=""
            placeholder={t(ChatI18nKeys.WriteText)}
            type="text"
            className={getFieldClassnames<Inputs>('title', 'input', {
              errors,
              dirtyFields,
              touchedFields,
            })}
            {...register('title')}
          ></input>
        </div>
        <div className="flex justify-end">
          <DialPrimaryButton
            label={t(ChatI18nKeys.Attach)}
            data-qa="attach"
            disabled={!isValid}
            type="submit"
          />
        </div>
      </form>
    </Modal>
  );
};
