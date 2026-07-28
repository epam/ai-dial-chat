import { IconDotsVertical, IconLogin } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getEntityNameFromId, isPredefinedEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getVersionFromId } from '@/src/utils/server/api';

import {
  ChatEvent,
  ChatEventOperations,
  ChatEventResult,
} from '@/src/types/chat-events';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import {
  ChatEventsActions,
  MarketplaceActions,
  ToolsetActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ChatEventsSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import {
  ButtonAppearance,
  DialDropdown,
  DialPopup,
  DialPrimaryButton,
  ElementSize,
  PopupSize,
} from '@epam/ai-dial-ui-kit';

const gridLayout = 'grid grid-cols-[5fr_3fr] md:grid-cols-[2fr_1fr_1fr]';

interface ToolsetLoginEventsProps {
  events: (ChatEvent & { method: ChatEventOperations.ToolsetSignIn })[];
}

export const ToolsetLoginEvents: FC<ToolsetLoginEventsProps> = ({ events }) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const eventsMap = useAppSelector(ChatEventsSelectors.selectEvents);
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const areToolsetsLoading = useAppSelector(ToolsetSelectors.selectIsLoading);
  const isReporting = useAppSelector(ChatEventsSelectors.selectIsReporting);

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

      if (t.authSettings?.authenticationType !== ToolsetAuthTypes.OAUTH) {
        dispatch(
          MarketplaceActions.setLoginEntity({
            toolset: t,
            disableAdminView: true,
          }),
        );
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
    [dispatch],
  );

  const handleDeclineAllClick = useCallback(() => {
    dispatch(
      ChatEventsActions.declineAllEvents({
        method: ChatEventOperations.ToolsetSignIn,
      }),
    );
  }, [dispatch]);

  const handleDecline = useCallback(
    (event: ChatEvent) => {
      dispatch(
        ChatEventsActions.reportEvent({
          event,
          result: ChatEventResult.Denied,
        }),
      );
    },
    [dispatch],
  );

  const handleMenuDeclineClick = useCallback(
    ({ key }: { key: string }) => {
      const event = eventsMap[key];

      if (!event) return;

      handleDecline(event);
    },
    [handleDecline, eventsMap],
  );

  useEffect(() => {
    dispatch(ToolsetActions.getToolsets());
  }, [dispatch]);

  // TODO: rework events list with DialGrid component
  return (
    <DialPopup
      open
      header={t(ChatI18nKeys.ToolsetLoginRequired)}
      headerClassName="px-3 md:px-6 pt-4 md:pt-6"
      hideClose
      portalId="chat"
      size={PopupSize.Md}
      dividers={false}
      className="mx-3 !h-auto !max-h-[600px] !bg-layer-2 md:m-0"
      footer={
        <div className="flex justify-end border-t border-t-tertiary px-3 py-4 md:px-6">
          <DialPrimaryButton
            label={t(ChatI18nKeys.DeclineAll)}
            onClick={handleDeclineAllClick}
            appearance={ButtonAppearance.Ghost}
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
        <div className="p-3 !pt-0 md:p-6">
          <h2 className="mb-4 text-sm text-secondary">
            {t(ChatI18nKeys.ToolsetsRequireLogin)}
          </h2>

          <div
            className="divide-y divide-tertiary rounded border border-secondary"
            data-qa="toolset-login-list"
          >
            <div className={classNames(gridLayout, 'bg-layer-1')}>
              <div className="p-2 text-sm text-secondary md:p-3">
                {t(ChatI18nKeys.Toolset)}
              </div>
              <div className="hidden p-2 text-sm text-secondary md:block">
                {t(ChatI18nKeys.Version)}
              </div>
              <div />
            </div>

            {loginToolsets.map(({ event, toolset, name, version }) => (
              <div
                key={event.id}
                className={classNames(gridLayout, 'bg-layer-3')}
                data-qa="toolset-login-row"
              >
                <div className="flex items-center gap-2 overflow-hidden p-2 md:p-3">
                  <ModelIcon
                    size={20}
                    entityId={event.params.toolsetId}
                    entity={toolset}
                  />
                  <div className="flex flex-col gap-1 truncate">
                    <span className="truncate text-sm text-primary">
                      {toolset?.name ?? name}
                    </span>
                    <span className="text-xs text-secondary md:hidden">
                      {toolset?.version ?? version}
                    </span>
                  </div>
                </div>

                <div className="hidden items-center truncate p-3 text-sm text-primary md:flex">
                  {toolset?.version ?? version}
                </div>

                <div className="flex items-center justify-end gap-2 p-2 md:p-3">
                  <DialPrimaryButton
                    className="hidden md:flex"
                    label={t(ChatI18nKeys.Decline)}
                    onClick={() => handleDecline(event)}
                    size={ElementSize.Small}
                    appearance={ButtonAppearance.Ghost}
                    disabled={isReporting}
                  />
                  <DialPrimaryButton
                    label={t(ChatI18nKeys.LogIn)}
                    iconBefore={<IconLogin size={16} />}
                    size={ElementSize.Small}
                    onClick={() => toolset && handleLoginClick(toolset)}
                    disabled={isReporting || !toolset}
                  />
                  <DialDropdown
                    className="md:hidden"
                    placement="bottom-start"
                    allowedPlacements={['top-start', 'top-end']}
                    items={[
                      {
                        key: event.id,
                        label: t(ChatI18nKeys.Decline),
                      },
                    ]}
                    onItemClick={handleMenuDeclineClick}
                  >
                    <IconDotsVertical size={20} className="text-secondary" />
                  </DialDropdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DialPopup>
  );
};
