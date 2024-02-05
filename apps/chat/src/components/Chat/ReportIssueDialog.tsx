import {
  ChangeEvent,
  FC,
  FormEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { checkValidity } from '@/src/utils/app/forms';
import { onBlur } from '@/src/utils/app/style-helpers';

import { ReportIssueBody } from '@/src/types/report-issue';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

import Modal from '@/src/components/Common/Modal';

import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

const reportIssue = async (fields: Omit<ReportIssueBody, 'email'>) => {
  const controller = new AbortController();
  return await fetch('api/report-issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify(fields),
  });
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportIssueDialog: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation(Translation.Settings);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [submitted, setSubmitted] = useState(false);

  const dispatch = useAppDispatch();

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const onChangeTitle = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const onChangeDescription = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      const inputs = [titleInputRef, descriptionInputRef];

      if (checkValidity(inputs)) {
        dispatch(
          UIActions.showToast({
            message: t('Reporting an issue in progress...'),
            type: 'loading',
          }),
        );
        handleClose();

        const response = await reportIssue({
          title,
          description,
        });

        if (response.ok) {
          dispatch(
            UIActions.showToast({
              message: t('Issue reported successfully'),
              type: 'success',
            }),
          );
          setTitle('');
          setDescription('');
        } else {
          dispatch(
            UIActions.showToast({
              message: t(errorsMessages.generalServer, {
                ns: 'common',
              }),
              type: 'error',
            }),
          );
        }
      }
    },
    [description, dispatch, handleClose, t, title],
  );

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  // Render the dialog.
  return (
    <Modal
      initialFocus={titleInputRef}
      portalId="theme-main"
      isOpen={isOpen}
      onClose={handleClose}
      dataQa="request-api-key-dialog"
      overlayClassName="fixed inset-0"
      containerClassName="inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[780px]"
      form={{
        noValidate: true,
        onSubmit: handleSubmit,
      }}
    >
      <div className="flex justify-between pb-4 text-base font-bold">
        {t('Report an issue')}
      </div>

      <div className="mb-4">
        <label
          className="mb-1 flex text-xs text-secondary"
          htmlFor="projectNameInput"
        >
          {t('Title')}
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <input
          ref={titleInputRef}
          name="titleInput"
          value={title}
          required
          title=""
          type="text"
          onBlur={onBlur}
          onChange={onChangeTitle}
          className={inputClassName}
        ></input>
        <EmptyRequiredInputMessage />
      </div>

      <div className="mb-5">
        <label
          className="mb-1 flex text-xs text-secondary"
          htmlFor="businessJustificationInput"
        >
          {t('Description')}
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <textarea
          ref={descriptionInputRef}
          name="descriptionInput"
          value={description}
          required
          title=""
          rows={10}
          onBlur={onBlur}
          onChange={onChangeDescription}
          className={inputClassName}
        ></textarea>
        <EmptyRequiredInputMessage />
      </div>
      <div className="flex  justify-end">
        <button type="submit" className="button button-primary">
          {t('Report an issue')}
        </button>
      </div>
    </Modal>
  );
};
