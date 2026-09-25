import { animateCelebrationSnapshots } from './celebration-snapshots';
import {
  RAVEN_GRAB,
  RAVEN_RESTORE,
  RAVEN_ROW_SECTIONS,
  RAVEN_SCENE_MS,
  ravenCargoPoint,
  ravenFacingFrames,
  type RavenCargoFrame,
  type RavenPlan,
} from './halloween-raven-plan';
import { RAVEN_FRAGMENT_CLIP } from './halloween-raven-targets';

interface RavenElements {
  host: HTMLElement;
  copies: HTMLElement;
  birds: HTMLElement[];
  nest: HTMLElement;
  fallback: HTMLElement | null;
}

/** Sections and beaks share cargo coordinates, including the two grip endpoints. */
export const ravenSectionTransform = (
  frame: RavenCargoFrame,
  section: number,
  original: { left: number; top: number; width: number; height: number },
) => {
  const from = ravenCargoPoint(frame, section / RAVEN_ROW_SECTIONS);
  const to = ravenCargoPoint(frame, (section + 1) / RAVEN_ROW_SECTIONS);
  const radians = (frame.rotation * Math.PI) / 180;
  const a = (to.x - from.x) / (original.width / RAVEN_ROW_SECTIONS);
  const b = (to.y - from.y) / (original.width / RAVEN_ROW_SECTIONS);
  const c = (-Math.sin(radians) * frame.height) / original.height;
  const d = (Math.cos(radians) * frame.height) / original.height;
  return `matrix(${a}, ${b}, ${c}, ${d}, ${from.x - original.left - (c * original.height) / 2}, ${from.y - original.top - (d * original.height) / 2})`;
};

const uniqueSectionIds = (copy: HTMLElement, section: number) => {
  const ids = new Map<string, string>();
  for (const element of [
    copy,
    ...copy.querySelectorAll<HTMLElement | SVGElement>('*'),
  ]) {
    if (element.id) {
      const id = `${element.id}-raven-${section}`;
      ids.set(element.id, id);
      element.id = id;
    }
  }
  for (const element of [
    copy,
    ...copy.querySelectorAll<HTMLElement | SVGElement>('*'),
  ]) {
    for (const attribute of [
      'fill',
      'stroke',
      'clip-path',
      'mask',
      'filter',
      'style',
    ]) {
      const initial = element.getAttribute(attribute);
      if (!initial) continue;
      const value = initial.replace(
        /url\(\s*(['"]?)#([^\s)'"]+)\1\s*\)/g,
        (reference, _quote: string, id: string) =>
          ids.has(id) ? `url(#${ids.get(id)})` : reference,
      );
      element.setAttribute(attribute, value);
    }
  }
};

/** One measured plan, one timeline and bounded copies; playback never reads layout. */
export const animateRavens = (
  plan: RavenPlan,
  { host, copies, birds, nest, fallback }: RavenElements,
  onStop: () => void,
): (() => void) => {
  if (!plan.active || typeof host.animate !== 'function')
    return () => undefined;
  const animations: Animation[] = [];
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  let stopped = false;
  const stopCopies: (() => void)[] = [];
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const events = [
    'pointerdown',
    'focusin',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'visibilitychange',
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    observer.disconnect();
    events.forEach((name) =>
      document.removeEventListener(name, interrupt, true),
    );
    window.removeEventListener('resize', stop);
    stopCopies.forEach((stopCopy) => stopCopy());
    fallback?.replaceChildren();
    animations.forEach((animation) => animation.cancel());
    onStop();
  };
  const interrupt = (event: Event) => {
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    if (event.type === 'visibilitychange' && !document.hidden) return;
    stop();
  };
  const targets = plan.anchors;
  const observer = new MutationObserver((records) => {
    if (
      targets.some(
        (element) =>
          !element.isConnected ||
          records.some(
            (record) =>
              element.contains(record.target) ||
              (record.type === 'attributes' &&
                record.target instanceof Element &&
                record.target.contains(element)),
          ),
      )
    )
      stop();
  });
  const animate = (element: Element, frames: Keyframe[]) => {
    const animation = element.animate(
      frames.map((frame) => ({ easing: 'ease-in-out', ...frame })),
      { duration: RAVEN_SCENE_MS, fill: 'both' },
    );
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  const sections = (
    copy: HTMLElement,
    original: { left: number; top: number; width: number; height: number },
  ) => {
    const content = copy.firstElementChild as HTMLElement | null;
    if (!content) return;
    copy.style.overflow = 'visible';
    content.remove();
    for (let section = 0; section < RAVEN_ROW_SECTIONS; section++) {
      const slice = document.createElement('div');
      slice.dataset.ravenRowSection = String(section);
      Object.assign(slice.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${original.width / RAVEN_ROW_SECTIONS + 0.5}px`,
        height: `${original.height}px`,
        overflow: 'hidden',
        transformOrigin: '0 0',
      });
      const cropped = content.cloneNode(true) as HTMLElement;
      uniqueSectionIds(cropped, section);
      /* Physical cropping must not right-align an oversized child in RTL. */
      Object.assign(cropped.style, {
        position: 'absolute',
        left: '0',
        right: 'auto',
        top: '0',
        margin: '0',
      });
      cropped.style.transform = `translateX(${(-section * original.width) / RAVEN_ROW_SECTIONS}px)`;
      slice.appendChild(cropped);
      copy.appendChild(slice);
      animate(
        slice,
        plan.cargo.map((frame) => ({
          offset: frame.offset,
          transform: ravenSectionTransform(frame, section, original),
        })),
      );
    }
  };
  try {
    plan.birds.forEach((bird, index) => {
      const actor = birds[index];
      if (!actor) throw new Error('Missing raven actor');
      animate(
        actor,
        bird.frames.map((frame) => ({
          offset: frame.offset,
          opacity: frame.opacity,
          transform: `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`,
        })),
      );
      const orientation = actor.querySelector('[data-raven-orientation]');
      if (orientation) {
        animate(
          orientation,
          ravenFacingFrames(bird).map(({ offset, facing, rotation }) => ({
            offset,
            transform: `rotate(${rotation}deg) scaleX(${facing})`,
          })),
        );
      }
      const wing = actor.querySelector('[data-raven-wing]');
      if (wing) {
        const beats: Keyframe[] = [];
        for (let time = 0; time <= RAVEN_SCENE_MS; time += 140) {
          const offset = time / RAVEN_SCENE_MS;
          const next =
            bird.frames.find((frame) => frame.offset >= offset) ??
            bird.frames[bird.frames.length - 1];
          const flying = next.flying;
          beats.push({
            offset,
            transform: flying
              ? `rotate(${beats.length % 2 ? -42 : 36}deg) scaleY(${beats.length % 2 ? 0.58 : 1})`
              : 'rotate(-8deg) scaleY(0.32)',
          });
        }
        animate(wing, beats);
      }
      const strip = actor.querySelector('[data-raven-carried-strip]');
      if (strip && bird.pickup !== undefined && bird.delivery !== undefined) {
        animate(strip, [
          {
            offset: 0,
            opacity: 0,
            transform: `scaleX(${bird.facing}) scaleY(0.02)`,
          },
          {
            offset: bird.pickup - 0.001,
            opacity: 0,
            transform: `scaleX(${bird.facing}) scaleY(0.02)`,
          },
          {
            offset: bird.pickup,
            opacity: 1,
            transform: `scaleX(${bird.facing}) scaleY(0.02)`,
          },
          {
            offset: bird.pickup + 0.05,
            opacity: 1,
            transform: `scaleX(${bird.facing}) scaleY(1)`,
          },
          {
            offset: bird.delivery,
            opacity: 1,
            transform: `scaleX(${bird.facing}) scaleY(0.5)`,
          },
          {
            offset: bird.delivery + 0.012,
            opacity: 0,
            transform: `scaleX(${bird.facing}) scaleY(0.2)`,
          },
          {
            offset: 1,
            opacity: 0,
            transform: `scaleX(${bird.facing}) scaleY(0.2)`,
          },
        ]);
      }
    });
    host.querySelectorAll('[data-raven-edge-gap]').forEach((gap, index) => {
      const pickup =
        plan.birds.find((bird) => bird.material === index)?.pickup ??
        RAVEN_GRAB;
      animate(gap, [
        { offset: 0, opacity: 0 },
        { offset: pickup, opacity: 0 },
        { offset: pickup + 0.04, opacity: 1 },
        { offset: 0.91, opacity: 1 },
        { offset: RAVEN_RESTORE, opacity: 0 },
        { offset: 1, opacity: 0 },
      ]);
    });
    const shake: Keyframe[] = [
      { offset: 0, transform: 'translate(0px, 0px) rotate(0deg)' },
      { offset: 0.745, transform: 'translate(0px, 0px) rotate(0deg)' },
      { offset: 0.77, transform: 'translate(0px, 4px) rotate(-3deg)' },
      { offset: 0.785, transform: 'translate(-5px, 0px) rotate(5deg)' },
      { offset: 0.805, transform: 'translate(5px, -2px) rotate(-5deg)' },
      { offset: 0.825, transform: 'translate(-3px, 0px) rotate(3deg)' },
      { offset: 0.85, transform: 'translate(0px, 0px) rotate(0deg)' },
      { offset: 1, transform: 'translate(0px, 0px) rotate(0deg)' },
    ];
    animate(nest, shake);
    if (plan.pumpkin) animate(plan.pumpkin.element, shake);
    const twigs = nest.querySelectorAll('[data-raven-twig]');
    twigs.forEach((twig, index) => {
      const bird = plan.birds[2 + (index % (plan.birds.length - 2))];
      const arrival = bird.delivery ?? 0.3;
      const scatterX = (index % 2 ? 1 : -1) * (45 + index * 5);
      animate(twig, [
        {
          offset: 0,
          opacity: 0,
          transform: 'translate(0px, -8px) rotate(0deg)',
        },
        {
          offset: arrival - 0.015,
          opacity: 0,
          transform: 'translate(0px, -8px) rotate(0deg)',
        },
        {
          offset: arrival + 0.025,
          opacity: 1,
          transform: 'translate(0px, 0px) rotate(0deg)',
        },
        {
          offset: 0.79,
          opacity: 1,
          transform: 'translate(0px, 0px) rotate(0deg)',
        },
        {
          offset: 0.91,
          opacity: 0,
          transform: `translate(${scatterX}px, ${-70 - index * 4}px) rotate(${scatterX}deg)`,
        },
        {
          offset: 1,
          opacity: 0,
          transform: `translate(${scatterX}px, -150px) rotate(${scatterX}deg)`,
        },
      ]);
    });
    const fragments = plan.birds.flatMap((bird, index) => {
      const material =
        bird.material === undefined ? undefined : plan.materials[bird.material];
      const slot = birds[index]?.querySelector<HTMLElement>(
        '[data-raven-fragment-slot]',
      );
      return material?.fragment && slot
        ? [{ bird, fragment: material.fragment, slot }]
        : [];
    });
    stopCopies.push(
      animateCelebrationSnapshots(
        fragments.map(({ fragment }) => fragment),
        host,
        {
          durationMs: RAVEN_SCENE_MS,
          hideAt: RAVEN_GRAB,
          hideOriginal: false,
          restoreAt: RAVEN_RESTORE,
          startTime,
          onStop: stop,
          decorateCopy: (copy, index) => {
            const { bird, fragment, slot } = fragments[index];
            const { crop, rect } = fragment;
            const content = copy.firstElementChild as HTMLElement;
            copy.dataset.ravenFragment = String(index);
            Object.assign(copy.style, {
              left: `${bird.facing < 0 ? -crop.width : 0}px`,
              top: `${-crop.height / 2}px`,
              width: `${crop.width}px`,
              height: `${crop.height}px`,
              clipPath: RAVEN_FRAGMENT_CLIP,
              transformOrigin: `${bird.facing < 0 ? '100%' : '0%'} 50%`,
            });
            Object.assign(content.style, {
              position: 'absolute',
              left: `${rect.left - crop.left}px`,
              right: 'auto',
              top: `${rect.top - crop.top}px`,
            });
            slot.appendChild(copy);
          },
          frames: (_rect, index) => {
            const { bird } = fragments[index];
            const pickup = bird.pickup ?? RAVEN_GRAB;
            const delivery = bird.delivery ?? 0.5;
            return [
              { offset: 0, opacity: 0, transform: 'rotate(0deg)' },
              { offset: pickup - 0.001, opacity: 0, transform: 'rotate(0deg)' },
              { offset: pickup, opacity: 1, transform: 'rotate(0deg)' },
              {
                offset: pickup + 0.025,
                opacity: 1,
                transform: `rotate(${-bird.facing * 9}deg)`,
              },
              {
                offset: pickup + 0.055,
                opacity: 1,
                transform: `rotate(${bird.facing * 18}deg)`,
              },
              {
                offset: delivery - 0.025,
                opacity: 1,
                transform: `rotate(${-bird.facing * 7}deg)`,
              },
              {
                offset: delivery,
                opacity: 1,
                transform: 'scale(0.55) rotate(0deg)',
              },
              {
                offset: delivery + 0.012,
                opacity: 0,
                transform: 'scale(0.35) rotate(0deg)',
              },
              { offset: 1, opacity: 0 },
            ];
          },
        },
      ),
    );
    if (stopped) return stop;
    if (plan.conversation) {
      const conversation = plan.conversation;
      stopCopies.push(
        animateCelebrationSnapshots([conversation], copies, {
          durationMs: RAVEN_SCENE_MS,
          hideAt: RAVEN_GRAB,
          restoreAt: RAVEN_RESTORE,
          startTime,
          onStop: stop,
          decorateCopy: (copy) => sections(copy, conversation.rect),
          frames: () =>
            plan.cargo.map((frame) => ({
              offset: frame.offset,
              opacity: frame.opacity,
            })),
        }),
      );
    } else if (fallback) {
      const frame = plan.cargo[0];
      const strip = document.createElement('div');
      Object.assign(strip.style, {
        width: `${frame.width}px`,
        height: `${frame.height}px`,
        border: '2px solid #b8a6cc',
        borderRadius: '3px',
        background: '#5c486c',
      });
      fallback.appendChild(strip);
      sections(fallback, {
        left: 0,
        top: 0,
        width: frame.width,
        height: frame.height,
      });
      animate(
        fallback,
        plan.cargo.map((frame) => ({
          offset: frame.offset,
          opacity: frame.opacity,
        })),
      );
    }
    if (stopped) return stop;
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'dir',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-expanded',
        'href',
      ],
    });
    events.forEach((name) => document.addEventListener(name, interrupt, true));
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, RAVEN_SCENE_MS);
  } catch {
    stop();
  }
  return stop;
};
