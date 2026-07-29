import { Input, Textarea } from '@epam/ai-dial-kit';
import {
  DialCheckbox,
  DialErrorText,
  DialFormItem,
  DialFormPopup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY_CHECKS, EMPTY_FIELDS } from '../../constants/request-api-key';
import {
  ButtonsI18nKeys,
  FooterRequestApiKeyI18nKeys,
} from '../../constants/translation-keys';
import { useRequestApiKey } from '../../hooks/useRequestApiKey/useRequestApiKey';
import type { RequestApiKeyPayload } from '../../server-api/footer.api';
import { EMAIL_REGEX, transformDateString } from '../../utils/request-api-key';
import CheckboxLabel from './CheckboxLabel';

interface Fields {
  project_id: string;
  project_stream: string;
  project_lead: string;
  business_reason: string;
  project_end: string;
  access_scenario: string;
  workload_pattern: string;
}

interface CheckboxState {
  azure: boolean;
  epam: boolean;
  client: boolean;
  local: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RequestApiKeyDialog: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const id = useId();
  const { submit, isLoading } = useRequestApiKey();

  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [checks, setChecks] = useState<CheckboxState>(EMPTY_CHECKS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((name: keyof Fields, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleCheckChange = useCallback(
    (name: keyof CheckboxState, value: boolean) => {
      setChecks((prev) => ({ ...prev, [name]: value }));
      setFieldErrors((prev) => {
        if (!prev.acknowledgements) return prev;
        const next = { ...prev };
        delete next.acknowledgements;
        return next;
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    setFields(EMPTY_FIELDS);
    setChecks(EMPTY_CHECKS);
    setFieldErrors({});
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const errors: Record<string, string> = {};
    const req = t(FooterRequestApiKeyI18nKeys.FieldRequired);
    const tooLong = (max: number) =>
      t(FooterRequestApiKeyI18nKeys.FieldTooLong, { max });

    if (!fields.project_id.trim()) {
      errors.project_id = req;
    } else if (fields.project_id.trim().length > 200) {
      errors.project_id = tooLong(200);
    }
    if (!fields.project_stream.trim()) {
      errors.project_stream = req;
    } else if (fields.project_stream.trim().length > 200) {
      errors.project_stream = tooLong(200);
    }
    if (!fields.project_lead.trim()) {
      errors.project_lead = req;
    } else if (!EMAIL_REGEX.test(fields.project_lead.trim())) {
      errors.project_lead = t(FooterRequestApiKeyI18nKeys.EmailInvalid);
    } else if (fields.project_lead.trim().length > 200) {
      errors.project_lead = tooLong(200);
    }
    if (!fields.business_reason.trim()) {
      errors.business_reason = req;
    } else if (fields.business_reason.trim().length > 4000) {
      errors.business_reason = tooLong(4000);
    }
    if (!fields.project_end.trim()) {
      errors.project_end = req;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.project_end)) {
      errors.project_end = t(FooterRequestApiKeyI18nKeys.DateInvalid);
    }
    if (!fields.access_scenario.trim()) {
      errors.access_scenario = req;
    } else if (fields.access_scenario.trim().length > 4000) {
      errors.access_scenario = tooLong(4000);
    }
    if (!fields.workload_pattern.trim()) {
      errors.workload_pattern = req;
    } else if (fields.workload_pattern.trim().length > 4000) {
      errors.workload_pattern = tooLong(4000);
    }
    const allChecked =
      checks.azure && checks.epam && checks.client && checks.local;
    if (!allChecked) {
      errors.acknowledgements = t(
        FooterRequestApiKeyI18nKeys.CheckboxGroupRequired,
      );
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: RequestApiKeyPayload = {
      project_id: fields.project_id.trim(),
      project_stream: fields.project_stream.trim(),
      project_lead: fields.project_lead.trim(),
      business_reason: fields.business_reason.trim(),
      project_end: transformDateString(fields.project_end),
      access_scenario: fields.access_scenario.trim(),
      workload_pattern: fields.workload_pattern.trim(),
    };

    const ok = await submit(payload);
    if (ok) handleClose();
  }, [fields, checks, submit, handleClose, t]);

  if (!isOpen) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DialFormPopup
      open
      header={t(FooterRequestApiKeyI18nKeys.Title)}
      onSubmit={() => void handleSubmit()}
      onClose={handleClose}
      submitLabel={t(ButtonsI18nKeys.Send)}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      isLoading={isLoading}
      size={PopupSize.Md}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <p className="dial-tiny-text text-secondary">
          {t(FooterRequestApiKeyI18nKeys.DescriptionPrefix)}
          <a
            href="https://github.com/epam/ai-dial"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            https://github.com/epam/ai-dial
          </a>
        </p>

        <DialFormItem
          id={`${id}-project-id`}
          label={t(FooterRequestApiKeyI18nKeys.ProjectNameLabel)}
          description={t(FooterRequestApiKeyI18nKeys.ProjectNameDescription)}
          error={fieldErrors.project_id}
          required
        >
          <Input
            id={`${id}-project-id`}
            value={fields.project_id}
            placeholder={t(FooterRequestApiKeyI18nKeys.ProjectNamePlaceholder)}
            onChange={(v) => handleChange('project_id', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-project-stream`}
          label={t(FooterRequestApiKeyI18nKeys.StreamNameLabel)}
          description={t(FooterRequestApiKeyI18nKeys.StreamNameDescription)}
          error={fieldErrors.project_stream}
          required
        >
          <Input
            id={`${id}-project-stream`}
            value={fields.project_stream}
            placeholder={t(FooterRequestApiKeyI18nKeys.StreamNamePlaceholder)}
            onChange={(v) => handleChange('project_stream', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-project-lead`}
          label={t(FooterRequestApiKeyI18nKeys.ProjectLeadLabel)}
          description={t(FooterRequestApiKeyI18nKeys.ProjectLeadDescription)}
          error={fieldErrors.project_lead}
          required
        >
          <Input
            id={`${id}-project-lead`}
            type="email"
            value={fields.project_lead}
            placeholder={t(FooterRequestApiKeyI18nKeys.ProjectLeadPlaceholder)}
            onChange={(v) => handleChange('project_lead', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-business-reason`}
          label={t(FooterRequestApiKeyI18nKeys.BusinessReasonLabel)}
          error={fieldErrors.business_reason}
          required
        >
          <Textarea
            id={`${id}-business-reason`}
            value={fields.business_reason}
            placeholder={t(
              FooterRequestApiKeyI18nKeys.BusinessReasonPlaceholder,
            )}
            onChange={(v) => handleChange('business_reason', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-project-end`}
          label={t(FooterRequestApiKeyI18nKeys.ProjectEndLabel)}
          error={fieldErrors.project_end}
          required
        >
          <Input
            id={`${id}-project-end`}
            type="date"
            value={fields.project_end}
            min={today}
            onChange={(v) => handleChange('project_end', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-access-scenario`}
          label={t(FooterRequestApiKeyI18nKeys.AccessScenarioLabel)}
          description={t(FooterRequestApiKeyI18nKeys.AccessScenarioDescription)}
          error={fieldErrors.access_scenario}
          required
        >
          <Textarea
            id={`${id}-access-scenario`}
            value={fields.access_scenario}
            placeholder={t(
              FooterRequestApiKeyI18nKeys.AccessScenarioPlaceholder,
            )}
            onChange={(v) => handleChange('access_scenario', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-workload-pattern`}
          label={t(FooterRequestApiKeyI18nKeys.WorkloadPatternLabel)}
          description={t(
            FooterRequestApiKeyI18nKeys.WorkloadPatternDescriptionPrefix,
          )}
          error={fieldErrors.workload_pattern}
          required
        >
          <Textarea
            id={`${id}-workload-pattern`}
            value={fields.workload_pattern}
            placeholder={t(
              FooterRequestApiKeyI18nKeys.WorkloadPatternPlaceholder,
            )}
            onChange={(v) => handleChange('workload_pattern', v ?? '')}
          />
          <p className="dial-tiny-text pt-1 text-secondary">
            {t(FooterRequestApiKeyI18nKeys.WorkloadPatternCaptionPrefix)}
            <a
              href="https://platform.openai.com/tokenizer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              platform.openai.com/tokenizer
            </a>
            {', '}
            <a
              href="https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              azure.microsoft.com/pricing
            </a>
          </p>
        </DialFormItem>

        <div className="flex flex-col gap-3">
          <p className="dial-small-semi-text text-primary">
            {t(FooterRequestApiKeyI18nKeys.CheckboxGroupTitle)}
          </p>

          <div className="flex flex-col gap-2">
            <DialCheckbox
              id={`${id}-cb-azure`}
              label={
                <CheckboxLabel>
                  <a
                    href="https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t(FooterRequestApiKeyI18nKeys.CheckboxAzureLabel)}
                  </a>
                </CheckboxLabel>
              }
              checked={checks.azure}
              onChange={(v) => handleCheckChange('azure', v ?? false)}
            />
            <DialCheckbox
              id={`${id}-cb-epam`}
              label={
                <CheckboxLabel>
                  {t(FooterRequestApiKeyI18nKeys.CheckboxEpamLabel)}
                </CheckboxLabel>
              }
              checked={checks.epam}
              onChange={(v) => handleCheckChange('epam', v ?? false)}
            />
            <DialCheckbox
              id={`${id}-cb-client`}
              label={
                <CheckboxLabel>
                  {t(FooterRequestApiKeyI18nKeys.CheckboxClientLabel)}
                </CheckboxLabel>
              }
              checked={checks.client}
              onChange={(v) => handleCheckChange('client', v ?? false)}
            />
            <DialCheckbox
              id={`${id}-cb-local`}
              label={
                <CheckboxLabel>
                  {t(FooterRequestApiKeyI18nKeys.CheckboxLocalLabel)}
                </CheckboxLabel>
              }
              checked={checks.local}
              onChange={(v) => handleCheckChange('local', v ?? false)}
            />
          </div>

          {fieldErrors.acknowledgements && (
            <DialErrorText text={fieldErrors.acknowledgements} />
          )}
        </div>
      </div>
    </DialFormPopup>
  );
};

export default memo(RequestApiKeyDialog);
