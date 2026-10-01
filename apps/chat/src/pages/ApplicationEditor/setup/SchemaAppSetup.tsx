import {
  DialSchemaRenderer,
  ErrorMessageNotification,
  type JsonSchema,
  SchemaRendererVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import type {
  ApplicationSetupProps,
  SchemaApplicationSetup,
} from '../../../models/application-editor';
import { getApplicationSchema } from '../../../server-api/application-schemas';
import { AppsEditorQuery } from '../../../types/apps-editor';
import { getSchemaTopLevelDefaults } from '../../../utils/application-editor';

type Props = ApplicationSetupProps<SchemaApplicationSetup>;

/** Setup of an editor-less schema app: a form rendered from the schema's JSON schema, saved as `applicationProperties`. */
const SchemaAppSetup: FC<Props> = ({
  value,
  errors,
  onChange,
  isEditMode,
  onReadyChange,
}) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const schemaId = searchParams.get(AppsEditorQuery.Schema) ?? '';
  const [schema, setSchema] = useState<JsonSchema>();
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const loadSchema = async () => {
      if (!schemaId) {
        setHasLoadError(true);
        return;
      }
      setHasLoadError(false);
      try {
        // The DTO is the schema document the BFF returns verbatim; a failed request rejects and is handled below.
        const loaded = (await getApplicationSchema(
          schemaId,
        )) as unknown as JsonSchema;
        if (!isCancelled) setSchema(loaded);
      } catch {
        if (!isCancelled) setHasLoadError(true);
      }
    };
    void loadSchema();
    return () => {
      isCancelled = true;
    };
  }, [schemaId]);

  /* Loading an edited app replaces the whole setup, so the schema's required
     list is re-applied whenever it differs from the one in the setup. It is a
     set, so only membership is compared. */
  const schemaRequired = schema?.required;
  const isRequiredSynced =
    schemaRequired !== undefined &&
    schemaRequired.length === value.requiredProperties.length &&
    schemaRequired.every((name) => value.requiredProperties.includes(name));
  useEffect(() => {
    if (schemaRequired && !isRequiredSynced) {
      onChange({ requiredProperties: schemaRequired });
    }
  }, [schemaRequired, isRequiredSynced, onChange]);

  /* The renderer reads `defaultValue` once on mount, so an edited app waits
     for its loaded properties before the form appears. */
  const isFormReady =
    schema !== undefined && !(isEditMode && value.properties === undefined);

  /* Until the schema's required list is in the setup, validation would let a
     save through with required fields empty, so the page's Create/Save waits. */
  const isReady = isFormReady && (!schema?.required || isRequiredSynced);
  useEffect(() => {
    onReadyChange(isReady);
  }, [isReady, onReadyChange]);

  /* Applied once, when the form mounts: the renderer fills in schema defaults
     only without a `defaultValue`, so an edited app gets the defaults of
     properties added to the schema after it was saved merged in here. */
  const defaultValue = useMemo(
    () =>
      schema && value.properties
        ? { ...getSchemaTopLevelDefaults(schema), ...value.properties }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, when the form mounts
    [isFormReady],
  );

  const handlePropertiesChange = useCallback(
    (properties: Record<string, unknown>) => onChange({ properties }),
    [onChange],
  );

  if (hasLoadError) {
    return (
      <ErrorMessageNotification
        message={t(AppsEditorI18nKeys.SchemaFormLoadFailed)}
      />
    );
  }

  if (!isFormReady) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner ariaLabel={t(AppsEditorI18nKeys.SettingsStepLoadingLabel)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {errors.properties && (
        <p role="alert" className="dial-small-text text-error">
          {errors.properties}
        </p>
      )}
      <DialSchemaRenderer
        schema={schema}
        variant={SchemaRendererVariant.Flat}
        defaultValue={defaultValue}
        // After a blocked save every missing required field is marked, not only the touched ones.
        skipUntouched={!errors.properties}
        onChange={handlePropertiesChange}
        onDefaultValues={handlePropertiesChange}
      />
    </div>
  );
};

export default memo(SchemaAppSetup);
