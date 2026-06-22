import { useCallback, useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppSelector } from '@/src/store/hooks';

import {
  MANDATORY_FIELD_PLACEHOLDER,
  SchemaDrivenAppForm,
} from '@/src/components/AppsEditor/form';

import {
  DialSchemaRenderer,
  JsonSchema,
  SchemaRendererVariant,
} from '@epam/ai-dial-ui-kit';
import omit from 'lodash-es/omit';

export const SchemaDrivenForm = () => {
  const { control, setValue } = useFormContext<SchemaDrivenAppForm>();
  const value = useWatch({
    control,
    name: 'properties',
  });

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const handleChange = useCallback(
    (path: string, v: unknown) => {
      setValue(
        'properties',
        { ...value, [path]: v },
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
    },
    [setValue, value],
  );

  const handleDefaultValues = useCallback(
    (v: Record<string, unknown>) => {
      setValue('properties', v, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
    },
    [setValue],
  );

  useEffect(() => {
    if (value[MANDATORY_FIELD_PLACEHOLDER]) {
      setValue('properties', omit(value, [MANDATORY_FIELD_PLACEHOLDER]), {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [setValue, value]);

  if (!schema) return null;

  return (
    <div className="size-full grow overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5">
      <DialSchemaRenderer
        schema={schema as unknown as JsonSchema}
        onPropertyChange={handleChange}
        onDefaultValues={handleDefaultValues}
        variant={SchemaRendererVariant.Flat}
        defaultValue={value}
      />
    </div>
  );
};
