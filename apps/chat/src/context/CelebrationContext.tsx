import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { loadCelebrationEvent } from '../celebrations/registry';
import type { CelebrationEvent, CelebrationScene } from '../types/celebration';
import { ROUTES } from '../types/routes';
import { UserConfigStatus } from '../types/user-config-status';
import {
  matchesCelebrationPhrase,
  pickCelebrationScene,
} from '../utils/celebration';
import { useAppConfig } from './AppConfigContext';
import { useNotification } from './NotificationContext';

interface CelebrationContextType {
  event: CelebrationEvent | null;
  isEnabled: boolean;
  celebrate: (sceneId: string) => void;
  activate: () => void;
  consumeSecretPhrase: (text: string) => boolean;
}

/* Decoration must also be safe in hosts that omit this optional provider. */
const CelebrationContext = createContext<CelebrationContextType>({
  event: null,
  isEnabled: false,
  celebrate: () => undefined,
  activate: () => undefined,
  consumeSecretPhrase: () => false,
});

interface Props {
  children: ReactNode;
}

/** Owns transient playback; event modules only provide artwork and scene definitions. */
export const CelebrationProvider: FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const { status, config } = useAppConfig();
  const location = useLocation();
  const { showSuccessNotification } = useNotification();
  const selectedId =
    status === UserConfigStatus.Ready && location.pathname === ROUTES.Root
      ? config.activeEventId
      : null;
  const [loaded, setLoaded] = useState<{
    event: CelebrationEvent;
    locationKey: string;
  } | null>(null);
  const [active, setActive] = useState<{
    scene: CelebrationScene;
    event: CelebrationEvent;
    locationKey: string;
    token: number;
  } | null>(null);
  const tokenRef = useRef(0);
  const previousClick = useRef<string | undefined>(undefined);
  const previousSecret = useRef<string | undefined>(undefined);
  const event =
    loaded?.event.id === selectedId && loaded?.locationKey === location.key
      ? loaded.event
      : null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setActive(null);
    previousClick.current = undefined;
    previousSecret.current = undefined;
    if (selectedId) {
      const load = async () => {
        try {
          const next = await loadCelebrationEvent(selectedId);
          if (!cancelled && next?.id === selectedId) {
            setLoaded({ event: next, locationKey: location.key });
          }
        } catch {
          /* A missing decorative chunk must leave the ordinary chat usable. */
        }
      };
      void load();
    }
    return () => {
      cancelled = true;
    };
  }, [selectedId, location.key]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(
      () => setActive(null),
      active.scene.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  const celebrate = useCallback(
    (sceneId: string) => {
      const scene = event?.scenes.find((candidate) => candidate.id === sceneId);
      if (!event || !scene) return;
      setActive({
        scene,
        event,
        locationKey: location.key,
        token: ++tokenRef.current,
      });
      showSuccessNotification({
        title: t(event.notificationTitleKey),
        message: event.secretTrigger
          ? t(scene.notificationKey, { phrase: event.secretTrigger.hintPhrase })
          : t(scene.notificationKey),
      });
    },
    [event, location.key, showSuccessNotification, t],
  );

  const activate = useCallback(() => {
    if (!event) return;
    const validIds = event.clickSceneIds.filter((id) =>
      event.scenes.some((scene) => scene.id === id),
    );
    const id = pickCelebrationScene(validIds, previousClick.current);
    if (id === undefined) return;
    previousClick.current = id;
    celebrate(id);
  }, [event, celebrate]);

  const consumeSecretPhrase = useCallback(
    (text: string) => {
      const trigger = event?.secretTrigger;
      if (
        !event ||
        !trigger ||
        !matchesCelebrationPhrase(text, trigger.phrases)
      )
        return false;
      const validIds = trigger.sceneIds.filter((id) =>
        event.scenes.some((scene) => scene.id === id),
      );
      const id = pickCelebrationScene(validIds, previousSecret.current);
      if (id === undefined) return false;
      previousSecret.current = id;
      celebrate(id);
      return true;
    },
    [event, celebrate],
  );

  const value = useMemo(
    () => ({
      event,
      isEnabled: event !== null,
      celebrate,
      activate,
      consumeSecretPhrase,
    }),
    [event, celebrate, activate, consumeSecretPhrase],
  );
  const Scene = active?.scene.Component;
  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {event &&
        active?.event === event &&
        active.locationKey === location.key &&
        Scene &&
        createPortal(
          <ErrorBoundary key={active.token} fallback={null}>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-[70] select-none overflow-hidden"
            >
              <Scene />
            </div>
          </ErrorBoundary>,
          document.body,
        )}
    </CelebrationContext.Provider>
  );
};

/** An inert default keeps optional event decoration safe outside the app shell. */
export const useCelebration = (): CelebrationContextType =>
  useContext(CelebrationContext);
