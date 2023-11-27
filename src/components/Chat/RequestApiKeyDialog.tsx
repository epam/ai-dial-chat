import { IconCheck, IconX } from '@tabler/icons-react';
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

import { RequestAPIKeyBody } from '@/src/types/request-api-key';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

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
  const { t } = useTranslation(Translation.Settings);

  const dispatch = useAppDispatch();

  const modalRef = useRef<HTMLFormElement>(null);
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

  const [projectName, setProjectName] = useState<string>('');
  const [scenario, setScenario] = useState<string>('');
  const [businessJustification, setBusinessJustification] =
    useState<string>('');
  const [projectEndDate, setProjectEndDate] = useState<string>('');
  const [techLeadName, setTechLeadName] = useState<string>('');
  const [streamName, setStreamName] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [azureAgreement, setAzureAgreement] = useState<boolean>(false);
  const [EPAMAgreement, setEPAMAgreement] = useState<boolean>(false);
  const [notClientProjectUsageAgreement, setNotClientProjectUsageAgreement] =
    useState<boolean>(false);
  const [localAgreement, setLocalAgreement] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState(false);

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const minDate = `${year}-${month}-${day}`;

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const projectNameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setProjectName(e.target.value);
  };

  const streamNameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setStreamName(e.target.value);
  };

  const businessJustificationOnChangeHandler = (
    e: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setBusinessJustification(e.target.value);
  };

  const techLeadNameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setTechLeadName(e.target.value);
  };

  const projectEndDateOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setProjectEndDate(e.target.value);
  };

  const scenarioOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setScenario(e.target.value);
  };

  const costOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCost(e.target.value);
  };

  const azureAgreementOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setAzureAgreement(e.target.checked);
  };

  const EPAMAgreementOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setEPAMAgreement(e.target.checked);
  };

  const notClientProjectUsageAgreementOnChangeHandler = (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    setNotClientProjectUsageAgreement(e.target.checked);
  };

  const localAgreementOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalAgreement(e.target.checked);
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);

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
      if (
        checkValidity(
          inputs as unknown as MutableRefObject<
            HTMLInputElement | HTMLTextAreaElement
          >[],
        )
      ) {
        dispatch(
          UIActions.showToast({
            message: t('Requesting API key in progress...'),
            type: 'loading',
          }),
        );
        handleClose();

        const response = await requestApiKey({
          access_scenario: scenario,
          business_reason: businessJustification,
          project_end: transformDateString(projectEndDate),
          project_id: projectName,
          project_lead: techLeadName,
          project_stream: streamName,
          workload_pattern: cost,
        });

        if (response.ok) {
          setScenario('');
          setBusinessJustification('');
          setProjectEndDate('');
          setProjectName('');
          setTechLeadName('');
          setStreamName('');
          setCost('');

          dispatch(
            UIActions.showToast({
              message: t('API Key requested succesfully'),
              type: 'success',
            }),
          );
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
    [
      businessJustification,
      cost,
      dispatch,
      handleClose,
      projectEndDate,
      projectName,
      scenario,
      streamName,
      t,
      techLeadName,
    ],
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

  // Render the dialog.
  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  const checkboxClassName = classNames('checkbox', 'peer', {
    'input-invalid': submitted,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5">
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block h-full overflow-y-auto rounded bg-gray-100 px-3 py-4 text-left align-bottom transition-all dark:bg-gray-700 md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
        role="dialog"
        onSubmit={handleSubmit}
      >
        <button
          className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
          onClick={handleClose}
        >
          <IconX height={24} width={24} />
        </button>

        <div className="flex justify-between pb-4 text-base font-bold">
          {t('Request API Key')}
        </div>

        <div>
          <label
            className="mb-1 flex text-xs text-gray-500"
            htmlFor="projectNameInput"
          >
            <span>1.</span>
            <span className="ml-1">
              {t('Project name (use one from Delivery Central)')}
            </span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <input
            ref={projectNameInputRef}
            name="projectNameInput"
            value={projectName}
            required
            title=""
            type="text"
            onBlur={onBlur}
            onChange={projectNameOnChangeHandler}
            className={inputClassName}
          ></input>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label
            className="flex text-xs text-gray-500"
            htmlFor="streamNameInput"
          >
            <span>2.</span>
            <span className="ml-1">
              {t('Stream Name (use one from Delivery Central)')}
            </span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <input
            ref={streamNameInputRef}
            name="streamNameInput"
            value={streamName}
            required
            title=""
            type="text"
            onBlur={onBlur}
            onChange={streamNameOnChangeHandler}
            className={inputClassName}
          ></input>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label
            className="mb-1 flex flex-col text-xs text-gray-500 md:flex-row"
            htmlFor="techLeadNameInput"
          >
            <span>
              <span>3.</span>
              <span className="ml-1">
                {t('Project Tech Lead responsible for API token usage.')}
              </span>
            </span>
            <span className="ml-1">
              {t('Please provide name')}
              <span className="ml-1 inline text-blue-500">*</span>
            </span>
          </label>
          <input
            ref={techLeadNameInputRef}
            name="techLeadNameInput"
            value={techLeadName}
            required
            title=""
            type="text"
            onBlur={onBlur}
            onChange={techLeadNameOnChangeHandler}
            className={inputClassName}
          ></input>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label
            className="mb-1 flex text-xs text-gray-500"
            htmlFor="businessJustificationInput"
          >
            <span>4.</span>
            <span className="ml-1">{t('Business justification')}</span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <textarea
            ref={businessJustificationInputRef}
            name="businessJustificationInput"
            value={businessJustification}
            required
            title=""
            onBlur={onBlur}
            onChange={businessJustificationOnChangeHandler}
            className={inputClassName}
          ></textarea>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label
            className="mb-1 flex text-xs text-gray-500"
            htmlFor="projectEndDateInput"
          >
            <span>5.</span>
            <span className="ml-1">{t('End date of the project')}</span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <input
            ref={projectEndDateInputRef}
            name="projectEndDateInput"
            value={projectEndDate}
            required
            title=""
            type="date"
            min={minDate}
            onBlur={onBlur}
            onChange={projectEndDateOnChangeHandler}
            className={inputClassName}
          ></input>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label className="mb-1 text-xs text-gray-500" htmlFor="scenarioInput">
            <span>6.</span>
            <span className="ml-1">
              {t(
                'By default, access to the model is available from EPAM VPN only. If you want to deploy your solution anywhere beyond your personal laptop, please describe your scenario.',
              )}
            </span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <textarea
            ref={scenarioInputRef}
            name="scenarioInput"
            value={scenario}
            required
            title=""
            onBlur={onBlur}
            onChange={scenarioOnChangeHandler}
            className={inputClassName}
          ></textarea>
          <EmptyRequiredInputMessage />
        </div>

        <div>
          <label
            className="mb-1 flex flex-wrap text-xs text-gray-500 xl:inline-block"
            htmlFor="costInput"
          >
            <span>
              <span>7.</span>
              <span className="ml-1">
                {t(
                  'We need to understand, how much cost your solution will generate monthly, and your workload pattern in terms of requests quantity and tokens usage during standard and peak workloads. Please describe this. More information is available at ',
                )}
              </span>
            </span>
            <a
              href="https://platform.openai.com/tokenizer"
              className="underline"
              rel="noopener noreferrer"
            >
              https://platform.openai.com/tokenizer
            </a>
            <span className="mr-1">,</span>
            <a
              href="https://openai.com/pricing"
              className="underline"
              rel="noopener noreferrer"
            >
              https://openai.com/pricing
            </a>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <textarea
            ref={costInputRef}
            name="costInput"
            value={cost}
            required
            title=""
            onBlur={onBlur}
            onChange={costOnChangeHandler}
            className={inputClassName}
          ></textarea>
          <EmptyRequiredInputMessage />
        </div>

        <div className="mb-4 mt-1 font-bold">
          {t('Also please acknowledge that your API usage should comply with:')}
        </div>

        <div className="peer mb-4  flex text-sm">
          <input
            ref={azureAgreementInputRef}
            name="azureAgreementInput"
            checked={azureAgreement}
            onChange={azureAgreementOnChangeHandler}
            onBlur={onBlur}
            required
            title=""
            type="checkbox"
            className={checkboxClassName}
          ></input>
          <label className="inline-block text-xs" htmlFor="azureAgreementInput">
            <span>1.</span>
            <span className="ml-1">
              {t('Azure cognitive service terms and conditions')}
            </span>
            <a
              href="https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct"
              className="underline"
              rel="noopener noreferrer"
            >
              (https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct)
            </a>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <IconCheck
            width={16}
            height={16}
            size={16}
            className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
          />
        </div>

        <div className="mb-4 flex text-xs">
          <input
            ref={EPAMAgreementInputRef}
            name="EPAMAgreementInput"
            checked={EPAMAgreement}
            onChange={EPAMAgreementOnChangeHandler}
            onBlur={onBlur}
            required
            type="checkbox"
            className={checkboxClassName}
          ></input>
          <label className="inline-block text-xs " htmlFor="EPAMAgreementInput">
            <span>2.</span>
            <span className="ml-1">
              {t('Usage is complaint to EPAM company policies')}
            </span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <IconCheck
            width={16}
            height={16}
            size={16}
            className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
          />
        </div>

        <div className="mb-4 flex text-xs">
          <input
            ref={notClientProjectUsageAgreementInputRef}
            name="notClientProjectUsageAgreementInput"
            checked={notClientProjectUsageAgreement}
            onChange={notClientProjectUsageAgreementOnChangeHandler}
            onBlur={onBlur}
            required
            type="checkbox"
            className={checkboxClassName}
          ></input>
          <label className="inline-block" htmlFor="EPAMAgreementInput">
            <span>3.</span>
            <span className="ml-1">
              {t(
                'Confirm that this key will not be used for client project production load.',
              )}
            </span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <IconCheck
            width={16}
            height={16}
            size={16}
            className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
          />
        </div>

        <div className="mb-5 flex text-xs">
          <input
            ref={localAgreementInputRef}
            name="localAgreementInput"
            checked={localAgreement}
            onChange={localAgreementOnChangeHandler}
            onBlur={onBlur}
            required
            type="checkbox"
            className={checkboxClassName}
          ></input>
          <label className="inline-block" htmlFor="localAgreementInput">
            <span>4.</span>
            <span className="ml-1">{t('Local law regulations (if some)')}</span>
            <span className="ml-1 inline text-blue-500">*</span>
          </label>
          <IconCheck
            width={16}
            height={16}
            size={16}
            className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="w-full rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200 md:w-fit"
          >
            {t('Send request')}
          </button>
        </div>
      </form>
    </div>
  );
};
