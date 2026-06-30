import type { CatalogItem } from '@epam/ai-dial-catalog';
import { Card, CatalogEntityType } from '@epam/ai-dial-catalog';
import { PrimaryButton } from '@epam/ai-dial-kit';
import {
  DialInput,
  DialNeutralButton,
  DialNotification,
  DialTagInput,
  DialTextarea,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { createApplication } from '../../server-api/applications';

const NAME_PATTERN = /^[a-zA-Z0-9 _.-]+$/;
const VERSION_PATTERN = /^[a-zA-Z0-9._-]+$/;

interface Props {
  schemaId: string;
  onCreated: (appId: string) => void;
  onCancel: () => void;
}

const GeneralForm: FC<Props> = ({ schemaId, onCreated, onCancel }) => {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [version, setVersion] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [versionError, setVersionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleNameChange = (value?: string) => {
    setName(value ?? '');
    if (nameError) setNameError('');
  };

  const handleVersionChange = (value?: string) => {
    setVersion(value ?? '');
    if (versionError) setVersionError('');
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedVersion = version.trim();
    if (!trimmedName) {
      setNameError(t(AppsEditorI18nKeys.GeneralFormNameRequired));
      return;
    }
    if (!NAME_PATTERN.test(trimmedName)) {
      setNameError(t(AppsEditorI18nKeys.GeneralFormNameInvalid));
      return;
    }
    if (trimmedVersion && !VERSION_PATTERN.test(trimmedVersion)) {
      setVersionError(t(AppsEditorI18nKeys.GeneralFormVersionInvalid));
      return;
    }
    setNameError('');
    setVersionError('');
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await createApplication({
        name: trimmedName,
        type: schemaId,
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        version: trimmedVersion || undefined,
        topics: topics.length > 0 ? topics : undefined,
      });
      onCreated(result.id);
    } catch {
      setSubmitError(t(AppsEditorI18nKeys.ErrorCreateFailed));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewItem = useMemo<CatalogItem>(
    () => ({
      id: 'preview',
      type: CatalogEntityType.Model,
      name,
      version,
      lastUsed: '',
      description,
      folder: [],
      topics,
      iconUrl: iconUrl.trim() || undefined,
    }),
    [name, version, description, topics, iconUrl],
  );

  return (
    <form
      noValidate
      className="flex h-full w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex h-full w-1/2 flex-col border-e border-e-primary">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <DialInput
            id="app-name"
            value={name}
            onChange={handleNameChange}
            labelProps={{
              label: t(AppsEditorI18nKeys.GeneralFormNameLabel),
              required: true,
            }}
            placeholder={t(AppsEditorI18nKeys.GeneralFormNamePlaceholder)}
            error={nameError || undefined}
            invalid={!!nameError}
          />

          <DialTextarea
            id="app-description"
            value={description}
            onChange={setDescription}
            labelProps={{
              label: t(AppsEditorI18nKeys.GeneralFormDescriptionLabel),
            }}
            placeholder={t(
              AppsEditorI18nKeys.GeneralFormDescriptionPlaceholder,
            )}
          />

          <DialInput
            id="app-icon-url"
            value={iconUrl}
            onChange={(value) => setIconUrl(value ?? '')}
            labelProps={{
              label: t(AppsEditorI18nKeys.GeneralFormIconUrlLabel),
            }}
            placeholder={t(AppsEditorI18nKeys.GeneralFormIconUrlPlaceholder)}
          />

          <DialInput
            id="app-version"
            value={version}
            onChange={handleVersionChange}
            labelProps={{
              label: t(AppsEditorI18nKeys.GeneralFormVersionLabel),
            }}
            placeholder={t(AppsEditorI18nKeys.GeneralFormVersionPlaceholder)}
            error={versionError || undefined}
            invalid={!!versionError}
          />

          <DialTagInput
            elementId="app-topics"
            label={t(AppsEditorI18nKeys.GeneralFormTopicsLabel)}
            placeholder={t(AppsEditorI18nKeys.GeneralFormTopicsPlaceholder)}
            onChange={setTopics}
          />

          {submitError && (
            <DialNotification
              variant={NotificationVariant.Error}
              message={submitError}
            />
          )}
        </div>

        <div className="flex shrink-0 border-t border-t-primary bg-layer-2 p-2">
          <div className="flex w-full justify-end gap-3">
            <DialNeutralButton
              type="button"
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
              disabled={isSubmitting}
            />
            <PrimaryButton
              type="submit"
              label={t(AppsEditorI18nKeys.GeneralFormNextButton)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div className="flex w-1/2 flex-col bg-layer-1 p-4">
        <p className="dial-small-text text-secondary">
          {t(AppsEditorI18nKeys.GeneralFormPreviewTitle)}
        </p>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-[280px]">
            <Card item={previewItem} />
          </div>
        </div>
      </div>
    </form>
  );
};

export default memo(GeneralForm);
