import { useCallback, useMemo } from 'react';

import { ApplicationActions } from '../store/application/application.reducers';
import { ConversationsActions } from '../store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ModelsSelectors } from '../store/models/models.reducers';
import { SettingsSelectors } from '../store/settings/settings.selectors';

export const useWidgets = () => {
  const dispatch = useAppDispatch();

  const widgetsSchemaIds = useAppSelector(
    SettingsSelectors.selectWidgetsSchemaIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);

  const widgetModels = useMemo(() => {
    return models.filter((m) =>
      widgetsSchemaIds.has(m.applicationTypeSchemaId ?? ''),
    );
  }, [models, widgetsSchemaIds]);

  const handleSelectWidget = useCallback(
    (id: string) => {
      dispatch(ApplicationActions.selectWidget(id));
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [],
        }),
      );
    },
    [dispatch],
  );

  return { widgetModels, handleSelectWidget };
};
