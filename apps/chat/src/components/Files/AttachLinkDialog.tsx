import { useCallback, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { FormValidations, getFieldClassnames } from '@/src/utils/app/forms';

import { DialLink } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '@/src/components/Common/Modal';

import { FieldErrorMessage } from '../Common/Forms/FieldError';

interface Props {
  onClose: (link?: DialLink) => void;
}

interface Inputs {
  href: string;
  title?: string;
}

export const AttachLinkDialog = ({ onClose }: Props) => {
  const { t } = useTranslation(Translation.Files);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isValid, dirtyFields, touchedFields },
  } = useForm<Inputs>({ mode: 'all' });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
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
      containerClassName="inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[780px]"
      heading={t('files.modal.attach_link.header')}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label
            className="mb-1 flex text-xs text-secondary-bg-dark"
            htmlFor="addressNameInput"
          >
            {t('files.modal.attach_link.address.label')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <input
            title=""
            placeholder={t('files.modal.attach_link.address.placeholder') ?? ''}
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

          <FieldErrorMessage error={errors.href} />
        </div>

        <div className="mb-5">
          <label
            className="mb-1 flex text-xs text-secondary-bg-dark"
            htmlFor="titleInput"
          >
            {t('files.modal.attach_link.title.label')}
          </label>
          <input
            title=""
            placeholder={t('files.modal.attach_link.title.placeholder') ?? ''}
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
          <button
            type="submit"
            className="button button-primary button-medium"
            disabled={!isValid}
          >
            {t('files.modal.button.attach')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
