import {
  DialSchemaRenderer,
  ErrorMessageNotification,
  type JsonSchema,
  SchemaRendererVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { AppsEditorI18nKeys } from '../../../constants/translation-keys';
import type {
  ApplicationSetupProps,
  SchemaApplicationSetup,
} from '../../../models/application-editor';
import { getApplicationSchema } from '../../../server-api/application-schemas';
import { AppsEditorQuery } from '../../../types/apps-editor';

type Props = ApplicationSetupProps<SchemaApplicationSetup>;

/** Setup of an editor-less schema app: a form rendered from the schema's JSON schema, saved as `applicationProperties`. */
const SchemaAppSetup: FC<Props> = ({ value, errors, onChange, isEditMode }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const schemaId = searchParams.get(AppsEditorQuery.Schema) ?? '';
  const [schema, setSchema] = useState<JsonSchema>();
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const loadSchema = async () => {
      setHasLoadError(false);
      try {
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
     list is re-applied whenever it differs from the one in the setup. */
  const schemaRequired = schema?.required;
  useEffect(() => {
    if (!schemaRequired) return;
    const isSame =
      schemaRequired.length === value.requiredProperties.length &&
      schemaRequired.every(
        (name, index) => name === value.requiredProperties[index],
      );
    if (!isSame) onChange({ requiredProperties: schemaRequired });
  }, [schemaRequired, value.requiredProperties, onChange]);

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

  /* The renderer reads `defaultValue` once on mount, so an edited app waits
     for its loaded properties before the form appears. */
  if (!schema || (isEditMode && value.properties === undefined)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
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
        defaultValue={value.properties}
        skipUntouched
        onChange={handlePropertiesChange}
        onDefaultValues={handlePropertiesChange}
      />
    </div>
  );
};

export default memo(SchemaAppSetup);
