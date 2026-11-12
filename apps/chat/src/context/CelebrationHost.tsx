import {
  CelebrationProvider,
  type CelebrationAnchors,
  type CelebrationEventLoader,
  type CelebrationNotification,
} from '@epam/ai-dial-celebrations';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
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
import { useCelebrationPacks } from '../hooks/celebration/useCelebrationPacks';
import { useCelebrationPreference } from '../hooks/celebration/useCelebrationPreference';
import { DEFAULT_LANGUAGE } from '../hooks/language/useLanguage';
import { ROUTES } from '../types/routes';
import { UserConfigStatus } from '../types/user-config-status';
import {
  mergeCelebrationLabels,
  toCelebrationColorScheme,
} from '../utils/celebration-pack';
import { useAppConfig } from './AppConfigContext';
import { useNotification } from './NotificationContext';
import { useTheme } from './ThemeContext';

/* Only compiled modules can load; configuration never becomes an import path.
   A pack only replaces scenes of these events or, for an admitted external-only
   event, goes through the fixed `packs` import inside `useCelebrationPacks`. */
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

/* The host passes no `selection`, so every scene stays enabled. */
const SELECTION_REVISION = 'none';

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

/** Adapts app config, the user's opt-in, routing, i18n and notifications to the celebrations library. */
export const CelebrationHost: FC<Props> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { status, config } = useAppConfig();
  const { currentTheme } = useTheme();
  const location = useLocation();
  const { showSuccessNotification } = useNotification();
  const isMobile = useIsMobile();
  const { isEnabled } = useCelebrationPreference();
  /* The operator picks the event; the user still has to opt in to see it. */
  const activeEventId =
    isEnabled &&
    status === UserConfigStatus.Ready &&
    location.pathname === ROUTES.Root
      ? config.activeEventId
      : null;
  const delivery = config.celebrationDelivery;
  const language = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE;
  const direction = i18n.dir(language);
  const colorScheme = toCelebrationColorScheme(currentTheme);
  const packs = useCelebrationPacks({
    compiledEvents: EVENTS,
    activeEventId,
    delivery,
    colorScheme,
    direction,
    language,
  });
  const hostLabels = useMemo(
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
  const labels = useMemo(
    () => mergeCelebrationLabels(packs.labels, hostLabels),
    [packs.labels, hostLabels],
  );
  /* Any change here cancels a playing scene and reloads the event, so the
     next activation uses the current policy, pack, theme, direction and
     layout. The language alone does not: it only re-translates the labels. */
  const resetKey = [
    location.key,
    activeEventId ?? 'none',
    delivery.mode,
    delivery.revision,
    packs.catalogRevision ?? 'none',
    packs.packKey,
    currentTheme,
    colorScheme,
    direction,
    isMobile ? 'mobile' : 'desktop',
    SELECTION_REVISION,
  ].join('|');
  const handleNotify = useCallback(
    ({ title, message }: CelebrationNotification) =>
      showSuccessNotification({ title, message }),
    [showSuccessNotification],
  );

  return (
    <CelebrationProvider
      events={packs.events}
      activeEventId={activeEventId}
      resetKey={resetKey}
      labels={labels}
      onNotify={handleNotify}
      isMobile={isMobile}
      anchors={ANCHORS}
    >
      {children}
    </CelebrationProvider>
  );
};
