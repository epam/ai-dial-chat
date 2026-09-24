import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_FEATURE_FLAG,
  HALLOWEEN_SECRET_PHRASE,
} from '../constants/halloween';
import { HalloweenI18nKeys } from '../constants/translation-keys';
import { HalloweenBurst } from '../types/halloween';
import { ROUTES } from '../types/routes';
import { isHalloweenSecretPhrase } from '../utils/halloween';
import { useFeatureFlag } from './AppConfigContext';
import { useNotification } from './NotificationContext';

/* Lazy so the celebration layer and its stylesheet stay out of the initial
   chunk — `halloweenEnabled` is off by default. */
const HalloweenBurstOverlay = lazy(
  () => import('../components/Halloween/HalloweenBurstOverlay'),
);

const BURST_MESSAGES: Record<HalloweenBurst, HalloweenI18nKeys> = {
  [HalloweenBurst.Ghost]: HalloweenI18nKeys.GhostToastMessage,
  [HalloweenBurst.Web]: HalloweenI18nKeys.WebToastMessage,
  [HalloweenBurst.Spiders]: HalloweenI18nKeys.SpidersToastMessage,
  [HalloweenBurst.Bats]: HalloweenI18nKeys.BatsToastMessage,
  [HalloweenBurst.Cat]: HalloweenI18nKeys.CatToastMessage,
  [HalloweenBurst.Witches]: HalloweenI18nKeys.WitchesToastMessage,
};

interface HalloweenContextType {
  /** Whether Halloween is enabled on the start page. Elsewhere every trigger is a no-op. */
  isEnabled: boolean;
  /** Plays `burst` and raises the accompanying notification. No-op while disabled. */
  celebrate: (burst: HalloweenBurst) => void;
  /**
   * Whether `text` is the easter egg's secret phrase, in which case the
   * spider drop has been started and the caller SHALL NOT send the message.
   * Always `false` while disabled, so a deployment without the flag sends
   * "trick or treat" as an ordinary message.
   */
  consumeSecretPhrase: (text: string) => boolean;
}

/*
 * The default is a disabled, inert easter egg rather than `undefined`: the
 * triggers live inside the new conversation composer, which is mounted in
 * plenty of trees (tests, and any host that skips the provider) where a
 * decorative feature has no business throwing.
 */
const DISABLED_HALLOWEEN: HalloweenContextType = {
  isEnabled: false,
  celebrate: () => undefined,
  consumeSecretPhrase: () => false,
};

const HalloweenContext =
  createContext<HalloweenContextType>(DISABLED_HALLOWEEN);

interface Props {
  children: ReactNode;
}

/**
 * Owns the Halloween easter egg: the currently playing celebration and the two
 * triggers that start one. State is in-memory only — nothing is persisted and
 * nothing reaches a backend.
 */
export const HalloweenProvider: FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isFeatureEnabled = useFeatureFlag(HALLOWEEN_FEATURE_FLAG);
  const isEnabled = isFeatureEnabled && location.pathname === ROUTES.Root;
  const { showSuccessNotification } = useNotification();
  /* The token changes on every trigger so a repeat of the same burst remounts
     the layer and restarts its animations. */
  const [active, setActive] = useState<{
    burst: HalloweenBurst;
    token: number;
    locationKey: string;
  } | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (active == null) return;
    const timer = window.setTimeout(
      () => setActive(null),
      HALLOWEEN_BURST_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  /* Clear the session on navigation as well as flag changes. The render guard
     also hides the portal immediately, before this effect can run. */
  useEffect(() => {
    setActive(null);
  }, [isEnabled, location.key]);

  const celebrate = useCallback(
    (burst: HalloweenBurst) => {
      if (!isEnabled) return;
      tokenRef.current += 1;
      setActive({ burst, token: tokenRef.current, locationKey: location.key });
      /* Every celebration reveals the phrase, regardless of the random scene. */
      showSuccessNotification({
        title: t(HalloweenI18nKeys.ToastTitle),
        message: t(BURST_MESSAGES[burst], { phrase: HALLOWEEN_SECRET_PHRASE }),
      });
    },
    [isEnabled, location.key, showSuccessNotification, t],
  );

  const consumeSecretPhrase = useCallback(
    (text: string) => {
      if (!isEnabled || !isHalloweenSecretPhrase(text)) return false;
      celebrate(HalloweenBurst.Spiders);
      return true;
    },
    [isEnabled, celebrate],
  );

  const value = useMemo(
    () => ({ isEnabled, celebrate, consumeSecretPhrase }),
    [isEnabled, celebrate, consumeSecretPhrase],
  );

  return (
    <HalloweenContext.Provider value={value}>
      {children}
      {isEnabled && active != null && active.locationKey === location.key && (
        <Suspense fallback={null}>
          <HalloweenBurstOverlay key={active.token} burst={active.burst} />
        </Suspense>
      )}
    </HalloweenContext.Provider>
  );
};

/**
 * The easter egg's state and triggers. Outside `HalloweenProvider` it resolves
 * to a permanently disabled easter egg, so a call site never needs to guard
 * for the provider's absence.
 */
export const useHalloween = (): HalloweenContextType =>
  useContext(HalloweenContext);
