import {
  CelebrationProvider,
  type CelebrationAnchors,
  type CelebrationEventLoader,
  type CelebrationNotification,
} from '@epam/ai-dial-celebrations';
import { CONVERSATION_INPUT_CLASS } from '@epam/ai-dial-conversation-input';
import { STARTER_BUTTONS_CLASS } from '@epam/ai-dial-starter-buttons';
import { useCallback, useMemo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { CELEBRATION_HISTORY_CLASS } from '../constants/celebration';
import {
  HalloweenI18nKeys,
  NewYearI18nKeys,
} from '../constants/translation-keys';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint';
import { ROUTES } from '../types/routes';
import { UserConfigStatus } from '../types/user-config-status';
import { useAppConfig } from './AppConfigContext';
import { useNotification } from './NotificationContext';

/* Only compiled modules can load; configuration never becomes an import path. */
const EVENTS: Readonly<Record<string, CelebrationEventLoader>> = {
  halloween: () => import('@epam/ai-dial-celebrations/halloween'),
  'new-year': () => import('@epam/ai-dial-celebrations/new-year'),
};

/* The library knows no host routes or other libraries' class names. */
const ANCHORS: CelebrationAnchors = {
  composer: CONVERSATION_INPUT_CLASS.wrapper,
  composerAddCluster: CONVERSATION_INPUT_CLASS.addCluster,
  composerModelSelector: CONVERSATION_INPUT_CLASS.modelSelectorButton,
  starterList: STARTER_BUTTONS_CLASS.list,
  historyContainer: CELEBRATION_HISTORY_CLASS,
  historyRowLink: `a[href^="${ROUTES.Conversations}/"]`,
  welcomeRegion: '[role="region"]',
};

/* Label ids are the key suffixes, so every existing key maps onto one label.
   `{{phrase}}` is passed through untouched: i18next would otherwise blank the
   missing variable before the library fills in the event's secret hint. */
const PHRASE_PLACEHOLDER = { phrase: '{{phrase}}' };

const toLabels = <Key extends string>(
  keys: readonly Key[],
  namespace: string,
  translate: (key: Key) => string,
): Record<string, string> =>
  Object.fromEntries(
    keys.map((key) => [key.replace(`${namespace}.`, ''), translate(key)]),
  );

interface Props {
  children: ReactNode;
}

/** Adapts app config, routing, i18n and notifications to the celebrations library. */
export const CelebrationHost: FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const { status, config } = useAppConfig();
  const location = useLocation();
  const { showSuccessNotification } = useNotification();
  const isMobile = useIsMobile();
  const activeEventId =
    status === UserConfigStatus.Ready && location.pathname === ROUTES.Root
      ? config.activeEventId
      : null;
  const labels = useMemo(
    () => ({
      halloween: toLabels(
        Object.values(HalloweenI18nKeys),
        'halloween',
        (key) => t(key, PHRASE_PLACEHOLDER),
      ),
      'new-year': toLabels(Object.values(NewYearI18nKeys), 'newYear', (key) =>
        t(key, PHRASE_PLACEHOLDER),
      ),
    }),
    /* `t` changes identity with the language, which re-translates the labels. */
    [t],
  );
  const handleNotify = useCallback(
    ({ title, message }: CelebrationNotification) =>
      showSuccessNotification({ title, message }),
    [showSuccessNotification],
  );

  return (
    <CelebrationProvider
      events={EVENTS}
      activeEventId={activeEventId}
      resetKey={location.key}
      labels={labels}
      onNotify={handleNotify}
      isMobile={isMobile}
      anchors={ANCHORS}
    >
      {children}
    </CelebrationProvider>
  );
};
