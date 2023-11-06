import {
  ChangeEvent,
  FC,
  FormEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { onBlur } from '@/src/utils/app/style-helpers';

import { ReportIssueBody } from '@/src/types/report-issue';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

import XMark from '../../../public/images/icons/xmark.svg';
import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

const checkValidity = (
  inputsRefs: MutableRefObject<HTMLInputElement | HTMLTextAreaElement>[],
) => {
  let isValid = true;
  let focusableElement: HTMLInputElement | HTMLTextAreaElement | null = null;

  inputsRefs.forEach(({ current }) => {
    if (
      current.required &&
      (!current.value ||
        (current.value === 'on' && !(current as any).checked) ||
        !current.validity.valid)
    ) {
      isValid = false;
      current.focus();
      current.blur();

      if (!focusableElement) {
        focusableElement = current;
      }
    }
  });

  if (focusableElement) {
    (focusableElement as HTMLInputElement | HTMLTextAreaElement).focus();
  }

  return isValid;
};

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
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLFormElement>(null);
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

      if (
        checkValidity(
          inputs as unknown as MutableRefObject<
            HTMLInputElement | HTMLTextAreaElement
          >[],
        )
      ) {
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

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      handleClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleClose]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5">
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block max-h-full w-full overflow-y-auto rounded bg-gray-100 px-3 py-4 text-left align-bottom transition-all dark:bg-gray-700 md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[780px]"
        role="dialog"
        onSubmit={handleSubmit}
      >
        <button
          className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
          onClick={handleClose}
        >
          <XMark height={24} width={24} />
        </button>

        <div className="flex justify-between pb-4 text-base font-bold">
          {t('Report an issue')}
        </div>

        <div className="mb-4">
          <label
            className="mb-1 flex text-xs text-gray-500"
            htmlFor="projectNameInput"
          >
            {t('Title')}
            <span className="ml-1 inline text-blue-500">*</span>
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
            className="mb-1 flex text-xs text-gray-500"
            htmlFor="businessJustificationInput"
          >
            {t('Description')}
            <span className="ml-1 inline text-blue-500">*</span>
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
          <button
            type="submit"
            className="w-full rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200 md:w-fit"
          >
            {t('Report an issue')}
          </button>
        </div>
      </form>
    </div>
  );
};
