import { Input, Textarea } from '@epam/ai-dial-kit';
import { DialFormItem, DialFormPopup, PopupSize } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  FooterReportIssueI18nKeys,
} from '../../constants/translation-keys';
import { useReportIssue } from '../../hooks/useReportIssue/useReportIssue';
import type { ReportIssuePayload } from '../../server-api/footer.api';

interface Fields {
  title: string;
  description: string;
}

const EMPTY_FIELDS: Fields = {
  title: '',
  description: '',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ReportIssueDialog: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const id = useId();
  const { submit, isLoading } = useReportIssue();

  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
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

  const handleClose = useCallback(() => {
    setFields(EMPTY_FIELDS);
    setFieldErrors({});
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const errors: Record<string, string> = {};
    const req = t(FooterReportIssueI18nKeys.FieldRequired);
    const tooLong = (max: number) =>
      t(FooterReportIssueI18nKeys.FieldTooLong, { max });

    if (!fields.title.trim()) {
      errors.title = req;
    } else if (fields.title.trim().length > 200) {
      errors.title = tooLong(200);
    }
    if (!fields.description.trim()) {
      errors.description = req;
    } else if (fields.description.trim().length > 4000) {
      errors.description = tooLong(4000);
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: ReportIssuePayload = {
      title: fields.title.trim(),
      description: fields.description.trim(),
    };

    const ok = await submit(payload);
    if (ok) handleClose();
  }, [fields, submit, handleClose, t]);

  if (!isOpen) return null;

  return (
    <DialFormPopup
      open
      header={t(FooterReportIssueI18nKeys.Title)}
      onSubmit={() => void handleSubmit()}
      onClose={handleClose}
      submitLabel={t(ButtonsI18nKeys.Send)}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      isLoading={isLoading}
      size={PopupSize.Sm}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <DialFormItem
          id={`${id}-title`}
          label={t(FooterReportIssueI18nKeys.IssueTitleLabel)}
          error={fieldErrors.title}
          required
        >
          <Input
            id={`${id}-title`}
            value={fields.title}
            placeholder={t(FooterReportIssueI18nKeys.IssueTitlePlaceholder)}
            onChange={(v) => handleChange('title', v ?? '')}
          />
        </DialFormItem>

        <DialFormItem
          id={`${id}-description`}
          label={t(FooterReportIssueI18nKeys.DescriptionLabel)}
          error={fieldErrors.description}
          required
        >
          <Textarea
            id={`${id}-description`}
            value={fields.description}
            placeholder={t(FooterReportIssueI18nKeys.DescriptionPlaceholder)}
            onChange={(v) => handleChange('description', v ?? '')}
            className="min-h-[160px]"
          />
        </DialFormItem>
      </div>
    </DialFormPopup>
  );
};

export default memo(ReportIssueDialog);
