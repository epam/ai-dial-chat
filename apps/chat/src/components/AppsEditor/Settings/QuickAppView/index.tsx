import { Editor } from '@monaco-editor/react';
import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';

import { ApplicationSettingsFormFooter } from '../ApplicationSettingsFormFooter';
import { QuickAppFormData, getQuickAppData } from '../form';

type Options<T extends Path<QuickAppFormData>> = Omit<
  RegisterOptions<QuickAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof QuickAppFormData]?: Options<K>;
};

export const validators: Validators = {
  toolset: {
    required: 'Toolset config is required',
    validate: (v) => {
      try {
        JSON.parse(v);
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
    },
  },
};

const ToolsetEditor = withErrorMessage(withLabel(Editor));
const Slider = withLabel(TemperatureSlider, true);

interface QuickAppViewProps {
  schema: ApiDetailedApplicationTypeSchema | null;
}

export const QuickAppView: React.FC<QuickAppViewProps> = ({ schema }) => {
  const { t } = useTranslation(Translation.Chat);
  const theme = useAppSelector(UISelectors.selectThemeState);

  const dispatch = useAppDispatch();

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, isValid },
  } = useFormContext<QuickAppFormData>();

  const handleSubmit = (data: QuickAppFormData) => {
    const applicationData = getQuickAppData(data);
    dispatch(
      ApplicationActions.update({
        oldApplicationId: data.id,
        applicationData: {
          ...applicationData,
          id: data.id,
          reference: data.reference,
        },
        schema: schema ?? undefined,
      }),
    );
  };

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex size-full flex-col bg-layer-2"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
        <Controller
          name="toolset"
          control={control}
          rules={validators['toolset']}
          render={({ field }) => (
            <ToolsetEditor
              label={t('Configure toolset')}
              error={errors.toolset?.message}
              height={200}
              options={{
                minimap: {
                  enabled: false,
                },
                padding: {
                  top: 12,
                  bottom: 12,
                },
                scrollBeyondLastLine: false,
              }}
              value={field.value}
              className="m-0.5 w-full overflow-hidden rounded border border-primary"
              language="json"
              onChange={(v) => field.onChange(v ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            />
          )}
        />

        <FieldTextArea
          {...register('instructions')}
          label={t('Instructions')}
          placeholder={t('Instructions of your application') || ''}
          rows={4}
          className="resize-none"
          id="instructions"
        />

        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <Slider
              label={t('Temperature') || ''}
              temperature={field.value}
              onChangeTemperature={field.onChange}
            />
          )}
        />
      </div>
      <ApplicationSettingsFormFooter isValid={isValid} />
    </form>
  );
};
