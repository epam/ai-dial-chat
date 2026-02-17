import { FC, useCallback, useMemo, useState } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getEntityDisplayName,
  isDialAiEntityModel,
} from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { AnyToolset } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/actions';
import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';
import { ToolsetTypes } from '@/src/constants/quick-apps';

import {
  QuickApp2Form as QuickApp2FormType,
  getAgentOrToolsetOption,
  getAgentsAndToolsetsFormValue,
  getQuickApp2Toolsets,
} from '@/src/components/AppsEditor/form';
import { AgentAndToolsetSelector } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { SimpleApplicationDetailsFooter } from '@/src/components/Marketplace/ApplicationDetails/SimpleApplicationDetailsFooter';
import { SimpleToolsetDetailsFooter } from '@/src/components/Marketplace/ToolsetsDetails/SimpleToolsetDetailsFooter';
import { ToolsetDetails } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

import { Feature } from '@epam/ai-dial-shared';
import {
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ConfirmationPopupVariant,
  DialButton,
  DialConfirmationPopup,
} from '@epam/ai-dial-ui-kit';
import sortBy from 'lodash-es/sortBy';

const AgentAndToolsetSelectorField = withLabel(AgentAndToolsetSelector);
const JsonEditor = withErrorMessage(withLabel(MonacoEditor));

interface AgentsAndToolsetsFieldProps {
  onAutoSave: (isSimpleViewSwitch?: boolean) => void;
}

export const AgentsAndToolsetsField: FC<AgentsAndToolsetsFieldProps> = ({
  onAutoSave,
}) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const isCodeInterpreterEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeInterpreter),
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const editorError = useAppSelector(ApplicationSelectors.selectEditorError);
  const isLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isDiscardingJson, setIsDiscardingJson] = useState(false);

  const { control, setValue, getValues, resetField } =
    useFormContext<QuickApp2FormType>();
  const { errors, dirtyFields } = useFormState<QuickApp2FormType>({ control });

  const isJsonView = useWatch({
    control,
    name: 'isJsonView',
  });

  const agentsAndToolsetsOptions = useWatch({
    control,
    name: 'agentsAndToolsets',
  });

  const agentsAndToolsetsJson = useWatch({
    control,
    name: 'agentsAndToolsetsJson',
  });

  const editorOptions = useMemo(
    () => ({
      readOnly: isAppPublic,
    }),
    [isAppPublic],
  );

  const allEntitiesMap = useMemo(
    () => ({
      ...modelsMap,
      ...toolsetsMap,
    }),
    [modelsMap, toolsetsMap],
  );

  const sortedAgentsAndToolsets = useMemo(() => {
    const ids = [...(agentsAndToolsetsOptions.map(({ id }) => id) || [])];

    const itemsWithName = ids.map((id) => ({
      id: id,
      name: getEntityDisplayName(id, allEntitiesMap),
    }));

    const sortedItems = sortBy(itemsWithName, [
      (item) => item.name.toLowerCase(),
    ]);

    return sortedItems.map((item) => item.id);
  }, [agentsAndToolsetsOptions, allEntitiesMap]);

  const detailedViewEntity = useMemo(
    () => (selectedEntityId ? allEntitiesMap[selectedEntityId] : null),
    [selectedEntityId, allEntitiesMap],
  );

  const switchToSimpleView = useCallback(() => {
    const toolsets = JSON.parse(agentsAndToolsetsJson) as AnyToolset[];
    setValue('agentsAndToolsets', getAgentsAndToolsetsFormValue(toolsets));
    if (isCodeInterpreterEnabled) {
      const withCodeInterpreter = !!toolsets.find(
        ({ type }) => type === ToolsetTypes.CodeInterpreter,
      );

      setValue('codeInterpreter', withCodeInterpreter, { shouldDirty: false });
    }
    setValue('isJsonView', !isJsonView, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [agentsAndToolsetsJson, isJsonView, setValue, isCodeInterpreterEnabled]);

  const handleJsonViewChange = useCallback(() => {
    if (isJsonView) {
      switchToSimpleView();
    } else {
      setValue(
        'agentsAndToolsetsJson',
        JSON.stringify(
          getQuickApp2Toolsets({
            data: getValues(),
            allEntitiesMap: allEntitiesMap as Record<string, MarketplaceEntity>,
          }),
          null,
          2,
        ),
      );
      setValue('isJsonView', !isJsonView, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [isJsonView, setValue, switchToSimpleView, getValues, allEntitiesMap]);

  const handleSaveJson = useCallback(() => {
    setValue('agentsAndToolsetsJson', agentsAndToolsetsJson, {
      shouldTouch: true,
      shouldDirty: true,
    });
    onAutoSave(true);
  }, [agentsAndToolsetsJson, onAutoSave, setValue]);

  const handleAgentsAndToolsetsChange = useCallback(
    (value: string[]) => {
      const processedValue = value.map((id) => ({
        id,
        tool:
          agentsAndToolsetsOptions.find((option) => option.id === id)?.tool ??
          getAgentOrToolsetOption(id),
      }));
      setValue('agentsAndToolsets', processedValue, {
        shouldTouch: true,
        shouldDirty: true,
      });
    },
    [agentsAndToolsetsOptions, setValue],
  );

  const handleCloseDiscard = useCallback(
    (result: boolean) => {
      if (result) {
        resetField('agentsAndToolsetsJson', {
          keepDirty: false,
          keepError: false,
        });
        setValue(
          'agentsAndToolsetsJson',
          JSON.stringify(
            getQuickApp2Toolsets({
              data: getValues(),
              allEntitiesMap: allEntitiesMap as Record<
                string,
                MarketplaceEntity
              >,
            }),
            null,
            2,
          ),
          { shouldDirty: false, shouldValidate: true, shouldTouch: false },
        );
        dispatch(ApplicationActions.setEditorError());
      }
      setIsDiscardingJson(false);
    },
    [allEntitiesMap, dispatch, getValues, resetField, setValue],
  );

  const handleOpenDetails = useCallback(
    (entity: MarketplaceEntity) => {
      setSelectedEntityId(entity.id);
      onAutoSave();
    },
    [onAutoSave],
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  const handleChangeVersionInDetails = useCallback(
    (entity: MarketplaceEntity) => {
      setSelectedEntityId(entity.id);
    },
    [],
  );

  const handleItemClick = useCallback(
    (id: string) => {
      const entity = allEntitiesMap[id];
      if (entity) {
        handleOpenDetails(entity);
      }
    },
    [allEntitiesMap, handleOpenDetails],
  );

  const commonDetailsProps = useMemo(
    () => ({
      onClose: handleCloseDetails,
      onChangeVersion: handleChangeVersionInDetails,
      isPreview: true,
    }),
    [handleCloseDetails, handleChangeVersionInDetails],
  );

  const shortEditorError = editorError
    ? t('App settings are not matching the schema')
    : undefined;

  const EditorButtons = useCallback(
    () => (
      <div className="flex h-full grow items-center justify-end gap-2 pr-3">
        <DialButton
          label={t('Discard')}
          variant={ButtonVariant.Neutral}
          size={ButtonSize.Small}
          appearance={ButtonAppearance.Outlined}
          onClick={() => setIsDiscardingJson(true)}
          disabled={!dirtyFields.agentsAndToolsetsJson && !editorError}
        />
        <DialButton
          label={t('Save JSON')}
          variant={ButtonVariant.Primary}
          size={ButtonSize.Small}
          onClick={handleSaveJson}
          disabled={
            !!errors.agentsAndToolsetsJson ||
            isLoading ||
            !dirtyFields.agentsAndToolsetsJson
          }
        />
      </div>
    ),
    [
      dirtyFields.agentsAndToolsetsJson,
      editorError,
      errors.agentsAndToolsetsJson,
      handleSaveJson,
      isLoading,
      t,
    ],
  );

  return (
    <>
      <Controller
        name="agentsAndToolsetsJson"
        control={control}
        render={({ field }) => (
          <div
            className={classNames('relative', {
              hidden: !isJsonView,
            })}
          >
            <div className="absolute right-0 top-[-5px]">
              <ToggleSwitch
                disabled={
                  !!errors.agentsAndToolsetsJson ||
                  !!editorError ||
                  isLoading ||
                  dirtyFields.agentsAndToolsetsJson
                }
                isOn
                handleSwitch={handleJsonViewChange}
                switchOnText={t('ON')}
                additionalText={t('JSON')}
                className="mb-2 flex w-fit items-center gap-2"
                tooltip={t(
                  'Switch to marketplace view for Agents and Toolsets',
                )}
              />
            </div>

            <JsonEditor
              label={t('Agents & Toolsets')}
              error={errors.agentsAndToolsetsJson?.message || shortEditorError}
              height={280}
              allowFullScreen
              onChange={field.onChange}
              value={field.value}
              language="json"
              options={editorOptions}
              errors={editorError ? [editorError] : undefined}
              renderButtons={EditorButtons}
            />
          </div>
        )}
      />

      <Controller
        name="agentsAndToolsets"
        control={control}
        render={() => {
          return (
            <>
              <div
                className={classNames({
                  'invisible h-0 overflow-hidden': isJsonView,
                })}
              >
                <AgentAndToolsetSelectorField
                  value={sortedAgentsAndToolsets}
                  onChange={handleAgentsAndToolsetsChange}
                  allItemsMap={allEntitiesMap}
                  label={t('Agents & Toolsets')}
                  readonly={isAppPublic}
                  tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
                  onItemClick={handleItemClick}
                  onJsonSwitchClick={handleJsonViewChange}
                />
              </div>
              {detailedViewEntity &&
                isDialAiEntityModel(detailedViewEntity) && (
                  <ApplicationDetails
                    entity={detailedViewEntity}
                    allEntities={allModels}
                    FooterComponent={SimpleApplicationDetailsFooter}
                    {...commonDetailsProps}
                  />
                )}

              {detailedViewEntity &&
                isToolsetEntityModel(detailedViewEntity) && (
                  <ToolsetDetails
                    entity={detailedViewEntity}
                    allEntities={allToolsets}
                    FooterComponent={SimpleToolsetDetailsFooter}
                    {...commonDetailsProps}
                  />
                )}
            </>
          );
        }}
      />

      <DialConfirmationPopup
        variant={ConfirmationPopupVariant.Danger}
        open={isDiscardingJson}
        header={t('Discard changes')}
        description={t(
          'Are you sure you want to lose all recent changes made to the JSON?',
        )}
        confirmLabel={t('Discard')}
        cancelLabel={t('Continue editing')}
        onConfirm={() => handleCloseDiscard(true)}
        onCancel={() => handleCloseDiscard(false)}
        onClose={() => handleCloseDiscard(false)}
      />
    </>
  );
};
