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
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_FEATURE_FLAG,
} from '../constants/halloween';
import { HalloweenI18nKeys } from '../constants/translation-keys';
import { HalloweenBurst } from '../types/halloween';
import { isHalloweenSecretPhrase } from '../utils/halloween';
import { useFeatureFlag } from './AppConfigContext';
import { useNotification } from './NotificationContext';

/* Lazy so the celebration layer and its stylesheet stay out of the initial
   chunk — `halloweenEnabled` is off by default. */
const HalloweenBurstOverlay = lazy(
  () => import('../components/Halloween/HalloweenBurstOverlay'),
);

interface HalloweenContextType {
  /** Whether the `halloweenEnabled` feature flag is on. `false` makes every trigger a no-op. */
  isEnabled: boolean;
  /** Plays `burst` and raises the accompanying notification. No-op while disabled. */
  celebrate: (burst: HalloweenBurst) => void;
  /**
   * Whether `text` is the easter egg's secret phrase, in which case the
   * treats burst has been started and the caller SHALL NOT send the message.
   * Always `false` while disabled, so a deployment without the flag sends
   * "trick or treat" as an ordinary message.
   */
  consumeSecretPhrase: (text: string) => boolean;
}

/*
 * The default is a disabled, inert easter egg rather than `undefined`: the
 * triggers live inside the two conversation composers, which are mounted in
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
  const isEnabled = useFeatureFlag(HALLOWEEN_FEATURE_FLAG);
  const { showSuccessNotification } = useNotification();
  /* The token changes on every trigger so a repeat of the same burst remounts
     the layer and restarts its animations. */
  const [active, setActive] = useState<{
    burst: HalloweenBurst;
    token: number;
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

  /* A deployment that turns the flag off mid-session — the client config is
     re-fetched, so `features.halloweenEnabled` can flip without a reload —
     should not be left with a celebration running. */
  useEffect(() => {
    if (!isEnabled) {
      setActive(null);
    }
  }, [isEnabled]);

  const celebrate = useCallback(
    (burst: HalloweenBurst) => {
      if (!isEnabled) return;
      tokenRef.current += 1;
      setActive({ burst, token: tokenRef.current });
      showSuccessNotification({
        title: t(HalloweenI18nKeys.ToastTitle),
        message: t(
          burst === HalloweenBurst.Ghost
            ? HalloweenI18nKeys.GhostToastMessage
            : HalloweenI18nKeys.TreatsToastMessage,
        ),
      });
    },
    [isEnabled, showSuccessNotification, t],
  );

  const consumeSecretPhrase = useCallback(
    (text: string) => {
      if (!isEnabled || !isHalloweenSecretPhrase(text)) return false;
      celebrate(HalloweenBurst.Treats);
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
      {active != null && (
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
