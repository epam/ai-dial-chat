import { FC, MutableRefObject, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { onChangeHandler } from '@/src/utils/app/components-helpers';

import { ReportIssueBody } from '@/src/types/report-issue';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

import XMark from '../../../public/images/icons/xmark.svg';

const checkValidity = (
  inputsRefs: MutableRefObject<HTMLInputElement | HTMLTextAreaElement>[],
) => {
  let isValid = true;
  let focusableElement: HTMLInputElement | HTMLTextAreaElement | null = null;

  inputsRefs.forEach(({ current }) => {
    if (
      current.required &&
      (!current.value || (current.value === 'on' && !(current as any).checked))
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
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const inputs = [titleInputRef, descriptionInputRef];

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex max-h-screen min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="inline-block max-h-[800px] overflow-y-auto rounded bg-gray-100 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-gray-700 sm:my-8 sm:max-h-[700px] sm:w-full sm:max-w-[550px] sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="flex justify-end text-gray-500">
              <button onClick={onClose}>
                <XMark height={24} width={24} />
              </button>
            </div>
            <div className="flex justify-between pb-4 text-base font-bold">
              {t('Report an issue')}
            </div>

            <div className="mb-5">
              <label
                className="mb-2 flex text-xs text-gray-500"
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
                type="text"
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-400');
                }}
                onChange={() => {
                  onChangeHandler(titleInputRef, setTitle);
                }}
                className="m-0 w-full rounded border border-gray-400 bg-transparent p-3 dark:border-gray-600"
              ></input>
            </div>

            <div className="mb-5">
              <label
                className="mb-2 flex text-xs text-gray-500"
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
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-400');
                }}
                onChange={() => {
                  onChangeHandler(descriptionInputRef, setDescription);
                }}
                className="m-0 h-[200px] w-full rounded border border-gray-400 bg-transparent p-3 dark:border-gray-600"
              ></textarea>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200"
                onClick={async () => {
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
                    onClose();

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
                }}
              >
                {t('Report an issue')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
