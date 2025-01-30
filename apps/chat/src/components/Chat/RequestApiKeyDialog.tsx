import { IconCheck } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { checkValidity } from '@/src/utils/app/forms';
import { onBlur } from '@/src/utils/app/style-helpers';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ServiceActions,
  ServiceSelectors,
} from '@/src/store/service/service.reducer';
import { UIActions } from '@/src/store/ui/ui.reducers';

import Modal from '@/src/components/Common/Modal';

import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

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

  const isSuccessfullySent = useAppSelector(
    ServiceSelectors.selectIsSuccessfullySent,
  );

  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const streamNameInputRef = useRef<HTMLInputElement>(null);
  const techLeadEmailInputRef = useRef<HTMLInputElement>(null);
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
  const [techLeadEmail, setTechLeadEmail] = useState<string>('');
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

  const techLeadEmailOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setTechLeadEmail(e.target.value);
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

  useEffect(() => {
    if (isSuccessfullySent) {
      dispatch(ServiceActions.resetIsSuccessfullySent());

      setScenario('');
      setBusinessJustification('');
      setProjectEndDate('');
      setProjectName('');
      setTechLeadEmail('');
      setStreamName('');
      setCost('');
    }
  }, [isSuccessfullySent, dispatch]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);

      const inputs = [
        projectNameInputRef,
        streamNameInputRef,
        techLeadEmailInputRef,
        businessJustificationInputRef,
        projectEndDateInputRef,
        scenarioInputRef,
        costInputRef,
        azureAgreementInputRef,
        EPAMAgreementInputRef,
        localAgreementInputRef,
        notClientProjectUsageAgreementInputRef,
      ];
      if (checkValidity(inputs)) {
        dispatch(
          UIActions.showLoadingToast(t('Requesting API key in progress...')),
        );
        dispatch(
          ServiceActions.requestApiKey({
            access_scenario: scenario,
            business_reason: businessJustification,
            project_end: transformDateString(projectEndDate),
            project_id: projectName,
            project_lead: techLeadEmail,
            project_stream: streamName,
            workload_pattern: cost,
          }),
        );
        handleClose();
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
      techLeadEmail,
    ],
  );

  // Render the dialog.
  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  const checkboxClassName = classNames('checkbox', 'peer', {
    'input-invalid': submitted,
  });

  return (
    <Modal
      initialFocus={projectNameInputRef}
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="request-api-key-dialog"
      overlayClassName="fixed inset-0"
      containerClassName="inline-block h-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      form={{
        noValidate: true,
        onSubmit: handleSubmit,
      }}
    >
      <div className="flex justify-between pb-4 text-base font-bold">
        {t('Request API Key')}
      </div>

      <div>
        <label
          className="mb-3 flex text-xs text-secondary"
          htmlFor="formDescription"
        >
          <span className="ml-1">
            {t(
              'We are glad to provide API access for PoC, research, accelerators development purposes, and internal projects. It is also possible to use this as a very short-term solution for early development stages while you are spinning up your dedicated environment. Any kind of client external must use their own dedicated infrastructure, not this API - you can install DIAL there, see instructions at ',
            )}
            <a
              href="https://github.com/epam/ai-dial"
              className="underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              https://github.com/epam/ai-dial
            </a>
          </span>
        </label>
      </div>

      <div>
        <label
          className="mb-1 flex text-xs text-secondary"
          htmlFor="projectNameInput"
        >
          <span>1.</span>
          <span className="ml-1">
            {t('Project name (use one from Delivery Central)')}
          </span>
          <span className="ml-1 inline text-accent-primary">*</span>
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
          className="flex text-xs text-secondary"
          htmlFor="streamNameInput"
        >
          <span>2.</span>
          <span className="ml-1">
            {t(
              'Stream Name (use one from Delivery Central). Must be unique per key request.',
            )}
          </span>
          <span className="ml-1 inline text-accent-primary">*</span>
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
          className="mb-1 flex flex-col text-xs text-secondary md:flex-row"
          htmlFor="techLeadEmailInput"
        >
          <span>
            <span>3.</span>
            <span className="ml-1">
              {t('Project Tech Lead responsible for API token usage.')}
            </span>
          </span>
          <span className="ml-1">
            {t('Please provide email')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </span>
        </label>
        <input
          ref={techLeadEmailInputRef}
          name="techLeadEmailInput"
          value={techLeadEmail}
          required
          title=""
          type="email"
          onBlur={onBlur}
          onChange={techLeadEmailOnChangeHandler}
          className={inputClassName}
        ></input>
        <EmptyRequiredInputMessage />
      </div>

      <div>
        <label
          className="mb-1 flex text-xs text-secondary"
          htmlFor="businessJustificationInput"
        >
          <span>4.</span>
          <span className="ml-1">{t('Business justification')}</span>
          <span className="ml-1 inline text-accent-primary">*</span>
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
          className="mb-1 flex text-xs text-secondary"
          htmlFor="projectEndDateInput"
        >
          <span>5.</span>
          <span className="ml-1">
            {t('End date of the project (YYYY-MM-DD)')}
          </span>
          <span className="ml-1 inline text-accent-primary">*</span>
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
        <label className="mb-1 text-xs text-secondary" htmlFor="scenarioInput">
          <span>6.</span>
          <span className="ml-1">
            {t(
              'By default, access to the model is available from EPAM VPN only. If you want to deploy your solution anywhere beyond your personal laptop, please describe your scenario.',
            )}
          </span>
          <span className="ml-1 inline text-accent-primary">*</span>
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
          className="mb-1 flex flex-wrap text-xs text-secondary xl:inline-block"
          htmlFor="costInput"
        >
          <span>
            <span>7.</span>
            <span className="ml-1">
              {t(
                'We need to understand, how much cost your solution will generate monthly, and your workload pattern in terms of requests quantity and tokens usage during standard and peak workloads. Please describe this. Ensure you provided "max X USD/month" metric. More information is available at ',
              )}
            </span>
          </span>
          <a
            href="https://platform.openai.com/tokenizer"
            className="underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            https://platform.openai.com/tokenizer
          </a>
          <span className="mr-1">,</span>
          <a
            href="https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/"
            className="underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/
          </a>
          <span className="ml-1 inline text-accent-primary">*</span>
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
            className="ml-1 underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            (https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct)
          </a>
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <IconCheck
          width={16}
          height={16}
          size={16}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
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
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <IconCheck
          width={16}
          height={16}
          size={16}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
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
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <IconCheck
          width={16}
          height={16}
          size={16}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
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
          <span className="ml-1 inline text-accent-primary">*</span>
        </label>
        <IconCheck
          width={16}
          height={16}
          size={16}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="button button-primary">
          {t('Send request')}
        </button>
      </div>
    </Modal>
  );
};
