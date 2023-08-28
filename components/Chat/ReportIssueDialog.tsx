import { IconAsterisk, IconX } from '@tabler/icons-react';
import { FC, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { showAPIToastError } from '@/utils/app/errors';

import { ReportIssueBody } from '@/types/report-issue';

import { errorsMessages } from '@/constants/errors';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex max-h-screen min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="dark:border-netural-400 inline-block max-h-[800px] overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[700px] sm:w-full sm:max-w-[550px] sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="flex justify-between pb-4 text-lg font-bold text-black dark:text-neutral-200">
              {t('Report an issue')}
              <button onClick={onClose}>
                <IconX></IconX>
              </button>
            </div>

            <div className="mb-5 text-sm font-bold text-black dark:text-neutral-200">
              <label className="mb-2 flex" htmlFor="projectNameInput">
                {t('Title')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <input
                ref={titleInputRef}
                name="titleInput"
                required
                type="text"
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full rounded-md border border-neutral-600 bg-white p-0 py-3 pl-3 pr-8 font-normal text-black shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)]"
              ></input>
            </div>

            <div className="mb-5 text-sm font-bold text-black dark:text-neutral-200">
              <label className="mb-2 flex" htmlFor="businessJustificationInput">
                {t('Description')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <textarea
                ref={descriptionInputRef}
                name="descriptionInput"
                required
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full rounded-md border border-neutral-600 bg-white p-0 py-3 pl-3 pr-8 font-normal text-black shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)]"
              ></textarea>
            </div>

            <button
              type="button"
              className="mt-6 flex h-8 w-full items-center justify-center rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
              onClick={async () => {
                if (
                  checkValidity(
                    inputs as unknown as MutableRefObject<
                      HTMLInputElement | HTMLTextAreaElement
                    >[],
                  )
                ) {
                  const loadingToast = toast.loading(
                    t('Reporting an issue in progress...'),
                  );
                  onClose();

                  const response = await reportIssue({
                    title: titleInputRef.current?.value as string,
                    description: descriptionInputRef.current?.value as string,
                  });

                  if (response.ok) {
                    toast.success(t('Issue reported successfully'), {
                      id: loadingToast,
                    });
                  } else {
                    showAPIToastError(
                      response,
                      t(errorsMessages.generalServer, { ns: 'common' }),
                      loadingToast,
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
  );
};
