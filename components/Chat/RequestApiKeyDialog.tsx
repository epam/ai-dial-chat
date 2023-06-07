import { IconAsterisk, IconX } from '@tabler/icons-react';
import { FC, MutableRefObject, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { showAPIToastError } from '@/utils/app/errors';

import { RequestAPIKeyBody } from '@/types/request-api-key';

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

  if (!!focusableElement) {
    (focusableElement as HTMLInputElement | HTMLTextAreaElement).focus();
  }

  return isValid;
};

const requestApiKey = async (
  fields: Omit<RequestAPIKeyBody, 'requester_email'>,
) => {
  const controller = new AbortController();
  return await fetch('api/request-api-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify(fields),
  });
};

function transformDateString(dateString: string): string {
  const dateParts = dateString.split('-');
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-GB');
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RequestAPIKeyDialog: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLDivElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const streamNameInputRef = useRef<HTMLInputElement>(null);
  const techLeadNameInputRef = useRef<HTMLInputElement>(null);
  const businessJustificationInputRef = useRef<HTMLTextAreaElement>(null);
  const projectEndDateInputRef = useRef<HTMLInputElement>(null);
  const scenarioInputRef = useRef<HTMLTextAreaElement>(null);
  const costInputRef = useRef<HTMLTextAreaElement>(null);
  const azureAgreementInputRef = useRef<HTMLInputElement>(null);
  const EPAMAgreementInputRef = useRef<HTMLInputElement>(null);
  const localAgreementInputRef = useRef<HTMLInputElement>(null);
  const notClientProjectUsageAgreementInputRef = useRef<HTMLInputElement>(null);
  const inputs = [
    projectNameInputRef,
    streamNameInputRef,
    techLeadNameInputRef,
    businessJustificationInputRef,
    projectEndDateInputRef,
    scenarioInputRef,
    costInputRef,
    azureAgreementInputRef,
    EPAMAgreementInputRef,
    localAgreementInputRef,
    notClientProjectUsageAgreementInputRef,
  ];

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const minDate = `${year}-${month}-${day}`;

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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen max-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="dark:border-netural-400 inline-block max-h-[800px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[700px] sm:w-full sm:max-w-[50%] sm:p-6 sm:align-middle"
            role="dialog"
          >
            <div className="flex justify-between text-lg pb-4 font-bold text-black dark:text-neutral-200">
              {t('Request API Key')}
              <button onClick={onClose}>
                <IconX></IconX>
              </button>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="projectNameInput">
                {t('1. Project name (use one from Delivery Central)')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <input
                ref={projectNameInputRef}
                name="projectNameInput"
                required
                type="text"
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></input>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="streamNameInput">
                {t('2. Stream Name (use one from Delivery Central)')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <input
                ref={streamNameInputRef}
                name="streamNameInput"
                required
                type="text"
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></input>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="techLeadNameInput">
                {t(
                  '3. Project Tech Lead responsible for API token usage. Please provide name',
                )}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <input
                ref={techLeadNameInputRef}
                name="techLeadNameInput"
                required
                type="text"
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></input>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="businessJustificationInput">
                {t('4. Business justification')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <textarea
                ref={businessJustificationInputRef}
                name="businessJustificationInput"
                required
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></textarea>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="projectEndDateInput">
                {t('5. End date of the project')}
                <span className="inline text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <input
                ref={projectEndDateInputRef}
                name="projectEndDateInput"
                required
                type="date"
                min={minDate}
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></input>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="flex mb-2" htmlFor="scenarioInput">
                {t(
                  '6. By default, access to the model is available from EPAM VPN only. If you want to deploy your solution anywhere beyond your personal laptop, please describe your scenario.',
                )}
              </label>
              <textarea
                ref={scenarioInputRef}
                name="scenarioInput"
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></textarea>
            </div>

            <div className="text-sm font-bold mb-5 text-black dark:text-neutral-200">
              <label className="inline-block mb-2" htmlFor="costInput">
                {t(
                  '7. We need to understand, how much cost your solution will generate monthly, and your workload pattern in terms of requests quantity and tokens usage during standard and peak workloads. Please describe this. More information is available at ',
                )}
                <a
                  href="https://platform.openai.com/tokenizer"
                  className="underline"
                >
                  https://platform.openai.com/tokenizer
                </a>{' '}
                ,{' '}
                <a href="https://openai.com/pricing" className="underline">
                  https://openai.com/pricing
                </a>
                <span className="inline-block text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
              <textarea
                ref={costInputRef}
                name="costInput"
                required
                onBlur={(e) => {
                  e.target.classList.add('invalid:border-red-500');
                }}
                className="m-0 w-full border rounded-md p-0 pr-8 pl-3 text-black font-normal py-3 border-neutral-600 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:bg-[#40414F] dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] dark:text-white"
              ></textarea>
            </div>

            <div className="text-lg font-bold mt-10 mb-5 text-black dark:text-neutral-200">
              {t(
                'Also please acknowledge that your API usage should comply with:',
              )}
            </div>

            <div className="text-sm font-bold mb-2 text-black dark:text-neutral-200 flex">
              <input
                ref={azureAgreementInputRef}
                name="azureAgreementInput"
                required
                type="checkbox"
                className="inline m-0 mr-2 border h-4 w-4 flex-shrink-0 rounded-sm text-black border-neutral-600 invalid:shadow-[0_0_1px_1px] invalid:shadow-red-500 accent-neutral-500 dark:bg-[#40414F]  dark:text-white"
              ></input>
              <label
                className="inline-block mb-2"
                htmlFor="azureAgreementInput"
              >
                {t('1. Azure cognitive service terms and conditions ')}
                <a
                  href="https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct"
                  className="underline"
                >
                  (https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct)
                </a>
                <span className="inline-block text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
            </div>

            <div className="text-sm font-bold mb-2 text-black dark:text-neutral-200 flex">
              <input
                ref={EPAMAgreementInputRef}
                name="EPAMAgreementInput"
                required
                type="checkbox"
                className="inline m-0 mr-2 border h-4 w-4 flex-shrink-0 rounded-sm text-black border-neutral-600 invalid:shadow-[0_0_1px_1px] invalid:shadow-red-500 accent-neutral-500 dark:bg-[#40414F]  dark:text-white"
              ></input>
              <label className="inline-block mb-2" htmlFor="EPAMAgreementInput">
                {t('2. Usage is complaint to EPAM company policies ')}
                <span className="inline-block text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
            </div>

            <div className="text-sm font-bold mb-2 text-black dark:text-neutral-200 flex">
              <input
                ref={notClientProjectUsageAgreementInputRef}
                name="notClientProjectUsageAgreementInput"
                required
                type="checkbox"
                className="inline m-0 mr-2 border h-4 w-4 flex-shrink-0 rounded-sm text-black border-neutral-600 invalid:shadow-[0_0_1px_1px] invalid:shadow-red-500 accent-neutral-500 dark:bg-[#40414F]  dark:text-white"
              ></input>
              <label className="inline-block mb-2" htmlFor="EPAMAgreementInput">
                {t(
                  '3. Confirm that this key will not be used for client project production load.',
                )}
                <span className="inline-block text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
            </div>

            <div className="text-sm font-bold mb-2 text-black dark:text-neutral-200 flex">
              <input
                ref={localAgreementInputRef}
                name="localAgreementInput"
                required
                type="checkbox"
                className="inline m-0 mr-2 border h-4 w-4 flex-shrink-0 rounded-sm text-black border-neutral-600 invalid:shadow-[0_0_1px_1px] invalid:shadow-red-500 accent-neutral-500 dark:bg-[#40414F]  dark:text-white"
              ></input>
              <label
                className="inline-block mb-2"
                htmlFor="localAgreementInput"
              >
                {t('4. Local law regulations (if some) ')}
                <span className="inline-block text-red-500">
                  <IconAsterisk size={10} />
                </span>
              </label>
            </div>

            <button
              type="button"
              className="flex items-center justify-center w-full px-4 py-2 mt-6 h-10 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
              onClick={async () => {
                if (
                  checkValidity(
                    inputs as unknown as MutableRefObject<
                      HTMLInputElement | HTMLTextAreaElement
                    >[],
                  )
                ) {
                  const loadingToast = toast.loading(
                    t('Requesting API key in progress...'),
                  );
                  onClose();

                  const response = await requestApiKey({
                    access_scenario: (
                      scenarioInputRef.current?.value as string
                    ).trim(),
                    business_reason: (
                      businessJustificationInputRef.current?.value as string
                    ).trim(),
                    project_end: transformDateString(
                      projectEndDateInputRef.current?.value as string,
                    ),
                    project_id: (
                      projectNameInputRef.current?.value as string
                    ).trim(),
                    project_lead: (
                      techLeadNameInputRef.current?.value as string
                    ).trim(),
                    project_stream: (
                      streamNameInputRef.current?.value as string
                    ).trim(),
                    workload_pattern: (
                      costInputRef.current?.value as string
                    ).trim(),
                  });

                  if (response.ok) {
                    toast.success(t('API Key requested succesfully'), {
                      id: loadingToast,
                    });
                  } else {
                    showAPIToastError(
                      response,
                      t(errorsMessages.generalServer),
                      loadingToast,
                    );
                  }
                }
              }}
            >
              {t('Send Request')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
