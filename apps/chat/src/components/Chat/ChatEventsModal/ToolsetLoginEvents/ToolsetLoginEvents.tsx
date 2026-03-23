import { IconLogin } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getEntityNameFromId, isPredefinedEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getVersionFromId } from '@/src/utils/server/api';

import { ChatEvent, ChatEventOperations } from '@/src/types/chat-events';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import {
  ChatEventsActions,
  MarketplaceActions,
  ToolsetActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  ChatEventsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  DialPopup,
  ElementSize,
  PopupSize,
} from '@epam/ai-dial-ui-kit';

interface ToolsetLoginEventsProps {
  events: (ChatEvent & { method: ChatEventOperations.ToolsetSignIn })[];
}

export const ToolsetLoginEvents: FC<ToolsetLoginEventsProps> = ({ events }) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const toolsets = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const areToolsetsLoading = useAppSelector(ToolsetSelectors.selectIsLoading);
  const isReporting = useAppSelector(ChatEventsSelectors.selectIsReporting);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const loginToolsets = useMemo(
    () =>
      events.map((event) => ({
        event,
        toolset: toolsets[event.params.toolsetId],
        name: getEntityNameFromId(event.params.toolsetId, {
          removeVersion: true,
        }),
        version: getVersionFromId(event.params.toolsetId),
      })),
    [events, toolsets],
  );

  const handleLoginClick = useCallback(
    (t: ToolsetModel) => {
      const isPublic = isEntityIdPublic(t) || isPredefinedEntity(t);

      if (
        (isPublic && isAdmin) ||
        t.authSettings?.authenticationType !== ToolsetAuthTypes.OAUTH
      ) {
        dispatch(MarketplaceActions.setLoginEntity(t));
      } else {
        dispatch(
          ToolsetActions.startSignInProcess({
            authLevel: isPublic
              ? ToolsetCredentialsLevel.USER
              : ToolsetCredentialsLevel.GLOBAL,
            toolset: t,
          }),
        );
      }
    },
    [dispatch, isAdmin],
  );

  const handleDeclineAllClick = useCallback(() => {
    dispatch(
      ChatEventsActions.declineAllEvents({
        method: ChatEventOperations.ToolsetSignIn,
      }),
    );
  }, [dispatch]);

  useEffect(() => {
    dispatch(ToolsetActions.getToolsets());
  }, [dispatch]);

  // TODO: rework events list with DialGrid component
  return (
    <DialPopup
      open
      header={t('Toolset login required')}
      hideClose
      portalId="chat"
      size={PopupSize.Md}
      dividers={false}
      className="!bg-layer-2"
      footer={
        <div className="flex justify-end border-t border-t-tertiary px-6 py-4">
          <DialButton
            label={t('Decline all')}
            onClick={handleDeclineAllClick}
            appearance={ButtonAppearance.Ghost}
            variant={ButtonVariant.Primary}
            disabled={areToolsetsLoading || isReporting}
          />
        </div>
      }
    >
      {areToolsetsLoading ? (
        <div className="flex justify-center p-6">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="p-6 pt-0">
          <h2 className="mb-4 text-sm text-secondary">
            {t(
              'The toolsets that "Quick app" uses to generate a response require a login',
            )}
          </h2>

          <div className="divide-y divide-tertiary rounded border border-secondary">
            <div className="grid grid-cols-[2fr_1fr_1fr] bg-layer-1">
              <div className="p-3 text-sm text-secondary">{t('Toolset')}</div>
              <div className="p-3 text-sm text-secondary">{t('Version')}</div>
              <div />
            </div>

            {loginToolsets.map(({ event, toolset, name, version }) => (
              <div
                key={event.id}
                className="grid grid-cols-[2fr_1fr_1fr] bg-layer-3"
              >
                <div className="flex items-center gap-2 p-3">
                  <ModelIcon
                    size={20}
                    entityId={event.params.toolsetId}
                    entity={toolset}
                  />
                  <span className="text-sm text-primary">
                    {toolset?.name ?? name}
                  </span>
                </div>
                <div className="flex items-center p-3 text-sm text-primary">
                  {toolset?.version ?? version}
                </div>
                <div className="flex items-center justify-end gap-2 p-3">
                  <DialButton
                    label={t('Log in')}
                    iconBefore={<IconLogin size={16} />}
                    size={ElementSize.Small}
                    variant={ButtonVariant.Primary}
                    onClick={() => toolset && handleLoginClick(toolset)}
                    disabled={isReporting || !toolset}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DialPopup>
  );
};
