export const HALLOWEEN_TRAIN_MS = 11000;

export interface HalloweenTrainPlan {
  mirrored: boolean;
  enter: number;
  exit: number;
  passenger?: {
    left: number;
    top: number;
    width: number;
    height: number;
    dx: number;
    dy: number;
    scale: number;
    arc: number;
  };
}

/** Measure the seasonal SVG, leaving its labelled button in place and focusable. */
export const getTrainPumpkin = (): SVGSVGElement | null => {
  const source = document.querySelector<SVGSVGElement>(
    '[data-halloween-pumpkin-anchor] svg',
  );
  if (!source) return null;
  const rect = source.getBoundingClientRect();
  const viewport = document.documentElement;
  if (
    rect.width < 16 ||
    rect.height < 16 ||
    rect.left < 0 ||
    rect.top < 0 ||
    rect.right > viewport.clientWidth ||
    rect.bottom > viewport.clientHeight
  )
    return null;
  for (
    let element: Element | null = source;
    element;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    )
      return null;
  }
  return source;
};

/** Artwork coordinates stay in one carrier; only the locomotive is mirrored. */
export const buildHalloweenTrainPlan = (
  train: DOMRect,
  viewportWidth: number,
  source?: DOMRect,
): HalloweenTrainPlan | null => {
  if (!train.width || !train.height) return null;
  const mirrored =
    !!source && source.left + source.width / 2 < viewportWidth / 2;
  const unit = train.width / 640;
  const passenger = source && {
    left: source.left - train.left,
    top: source.top - train.top,
    width: source.width,
    height: source.height,
    dx:
      train.left +
      (mirrored ? 640 - 544 : 544) * unit -
      source.left -
      source.width / 2,
    dy: train.top + 84 * unit - source.top - source.height / 2,
    scale: (70 * unit) / source.width,
    arc: Math.min(150, Math.max(65, train.width * 0.2)),
  };
  return {
    mirrored,
    enter: mirrored ? -train.right - 32 : viewportWidth - train.left + 32,
    exit: mirrored ? viewportWidth - train.left + 32 : -train.right - 32,
    passenger,
  };
};

interface TrainActors {
  carrier: HTMLElement;
  passenger: HTMLElement;
  source: SVGSVGElement | null;
}

/** All borrowed artwork, optional sound and scene animations share one lifetime. */
export const animateHalloweenTrain = (
  plan: HalloweenTrainPlan,
  actors: TrainActors,
  onStop: () => void,
  audioSrc?: string,
): (() => void) => {
  if (typeof actors.carrier.animate !== 'function') return () => undefined;
  const animations: Animation[] =
    actors.carrier.getAnimations?.({ subtree: true }) ?? [];
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  let stopped = false;
  let timer = 0;
  let observer: MutationObserver | undefined;
  let audio: HTMLAudioElement | undefined;
  const documentEvents = [
    'pointerdown',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'focusin',
    'scroll',
    'visibilitychange',
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    observer?.disconnect();
    documentEvents.forEach((event) =>
      document.removeEventListener(event, stop, true),
    );
    window.removeEventListener('resize', stop);
    animations.forEach((animation) => animation.cancel());
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    onStop();
  };
  const animate = (element: Element, frames: Keyframe[]) => {
    const animation = element.animate(frames, {
      duration: HALLOWEEN_TRAIN_MS,
      fill: 'both',
    });
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    animate(actors.carrier, [
      {
        offset: 0,
        transform: `translateX(${plan.enter}px)`,
        opacity: 1,
        easing: 'cubic-bezier(0.18, 0.7, 0.25, 1)',
      },
      { offset: 0.2, transform: 'translateX(0px)', opacity: 1 },
      {
        offset: 0.5,
        transform: 'translateX(0px)',
        opacity: 1,
        easing: 'cubic-bezier(0.55, 0, 0.85, 0.4)',
      },
      { offset: 0.86, transform: `translateX(${plan.exit}px)`, opacity: 1 },
      { offset: 0.88, transform: `translateX(${plan.exit}px)`, opacity: 0 },
      { offset: 1, transform: `translateX(${plan.exit}px)`, opacity: 0 },
    ]);
    const passenger = plan.passenger;
    if (passenger && actors.source) {
      const { dx, dy, scale, arc, height } = passenger;
      const landed = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`;
      const jump = Array.from({ length: 17 }, (_, index) => {
        const progress = index / 16;
        const size = 1 + (scale - 1) * progress;
        return {
          offset: 0.28 + progress * 0.16,
          opacity: 1,
          transform: `translate(${dx * progress}px, ${dy * progress - 4 * arc * progress * (1 - progress)}px) scale(${size}) rotate(${Math.sin(progress * Math.PI) * (plan.mirrored ? 16 : -16)}deg)`,
        };
      });
      animate(actors.passenger, [
        {
          offset: 0,
          opacity: 0,
          transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
        },
        {
          offset: 0.219,
          opacity: 0,
          transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
        },
        {
          offset: 0.22,
          opacity: 1,
          transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
          easing: 'ease-in',
        },
        {
          offset: 0.255,
          opacity: 1,
          transform: `translate(0px, ${height * 0.07}px) scale(1.08, 0.86) rotate(0deg)`,
          easing: 'ease-out',
        },
        ...jump,
        {
          offset: 0.46,
          opacity: 1,
          transform: `translate(${dx}px, ${dy + height * scale * 0.05}px) scale(${scale * 1.08}, ${scale * 0.9}) rotate(0deg)`,
          easing: 'ease-out',
        },
        { offset: 0.485, opacity: 1, transform: landed },
        { offset: 1, opacity: 1, transform: landed },
      ]);
      animate(actors.source, [
        { offset: 0, opacity: 1 },
        { offset: 0.219, opacity: 1 },
        { offset: 0.22, opacity: 0 },
        { offset: 0.87, opacity: 0 },
        { offset: 0.94, opacity: 1 },
        { offset: 1, opacity: 1 },
      ]);
    }
  } catch {
    stop();
    return stop;
  }
  if (audioSrc) {
    try {
      audio = new Audio(audioSrc);
      audio.volume = 0.35;
      audio.loop = false;
      const playback = audio;
      const play = async () => {
        try {
          await playback.play();
          if (stopped) playback.pause();
        } catch {
          /* Autoplay or a missing clip must never interrupt the visual scene. */
        }
      };
      play();
    } catch {
      /* Missing media support leaves the visual scene available. */
    }
  }
  if (startTime !== undefined) {
    actors.carrier.getAnimations?.({ subtree: true }).forEach((animation) => {
      animation.startTime = startTime;
    });
  }
  documentEvents.forEach((event) =>
    document.addEventListener(event, stop, true),
  );
  window.addEventListener('resize', stop);
  if (actors.source) {
    observer = new MutationObserver(() => {
      if (!actors.source?.isConnected) stop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  timer = window.setTimeout(stop, HALLOWEEN_TRAIN_MS);
  return stop;
};
