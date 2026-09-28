import type {
  HalloweenWebPlan,
  HalloweenWebThread,
  Point,
} from './halloween-web-plan';

const END_MS = 13700;
const FADE_MS = 11200;
const FRAME_MS = 1000 / 30;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const progressAt = (time: number, delay: number, duration: number) =>
  clamp((time - delay) / duration);
const interpolate = (a: Point, b: Point, progress: number): Point => ({
  x: a.x + (b.x - a.x) * progress,
  y: a.y + (b.y - a.y) * progress,
});

const pointAt = (points: readonly Point[], progress: number) => {
  const position = clamp(progress) * (points.length - 1);
  const index = Math.min(Math.floor(position), points.length - 2);
  const from = points[index];
  const to = points[index + 1];
  return {
    ...interpolate(from, to, position - index),
    angle: Math.atan2(to.y - from.y, to.x - from.x),
  };
};

/** Rasterize three walking poses once; no filters or gradients run per spider/frame. */
const createSpiderSprite = (pose: number): HTMLCanvasElement => {
  const sprite = document.createElement('canvas');
  sprite.width = 96;
  sprite.height = 96;
  const context = sprite.getContext('2d');
  if (!context) return sprite;
  context.scale(1.5, 1.5);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 4; leg++) {
      const step = Math.sin((pose * Math.PI * 2) / 3 + leg * Math.PI) * 2;
      context.beginPath();
      context.moveTo(32 + side * 5, 26 + leg * 4);
      context.lineTo(32 + side * (15 + (leg % 2) * 4), 12 + leg * 11 + step);
      context.lineTo(32 + side * (27 - leg * 1.5), 8 + leg * 15 - step);
      context.strokeStyle = '#a391a4';
      context.lineWidth = 3.1;
      context.stroke();
      context.strokeStyle = '#292131';
      context.lineWidth = 1.8;
      context.stroke();
    }
  }
  const body = context.createRadialGradient(27, 28, 1, 33, 36, 20);
  body.addColorStop(0, '#837789');
  body.addColorStop(0.4, '#413447');
  body.addColorStop(1, '#100c19');
  context.fillStyle = body;
  context.strokeStyle = '#ad9aab';
  context.lineWidth = 0.7;
  context.beginPath();
  context.ellipse(32, 38, 11, 15, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#b85e39';
  context.beginPath();
  context.moveTo(28, 33);
  context.lineTo(36, 33);
  context.lineTo(30, 44);
  context.lineTo(35, 44);
  context.closePath();
  context.fill();
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(32, 24, 9, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  for (const x of [28.5, 35.5]) {
    context.fillStyle = '#ffc36d';
    context.beginPath();
    context.ellipse(x, 22, 2.8, 3.3, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#201225';
    context.beginPath();
    context.ellipse(x, 21.6, 1.1, 1.8, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff2d2';
    context.fillRect(x - 1, 20, 1, 1);
  }
  return sprite;
};

interface Options {
  reducedMotion: boolean;
  color: string;
  pixelRatio?: number;
}

/** One scene clock, an incremental silk cache and bounded bitmap compositing. */
export const animateHalloweenWeb = (
  canvas: HTMLCanvasElement,
  plan: HalloweenWebPlan,
  { reducedMotion, color, pixelRatio = 1 }: Options,
): (() => void) => {
  const context = canvas.getContext('2d');
  if (!context || plan.width <= 0 || plan.height <= 0) return () => undefined;
  const silk = document.createElement('canvas');
  const silkContext = silk.getContext('2d');
  if (!silkContext) return () => undefined;
  const scale = Math.min(
    Math.max(1, pixelRatio),
    1.5,
    Math.sqrt(3000000 / (plan.width * plan.height)),
  );
  const width = Math.max(1, Math.floor(plan.width * scale));
  const height = Math.max(1, Math.floor(plan.height * scale));
  for (const surface of [canvas, silk]) {
    surface.width = width;
    surface.height = height;
  }
  context.scale(scale, scale);
  silkContext.scale(scale, scale);
  silkContext.strokeStyle = color;
  silkContext.globalAlpha = 0.28;
  silkContext.lineWidth = 0.65;
  context.strokeStyle = color;
  context.lineWidth = 0.65;
  const sprites = [0, 1, 2].map(createSpiderSprite);
  const threads: (HalloweenWebThread & { drawn: number })[] = [
    ...plan.strands,
    ...plan.webs.flatMap((web) => [
      ...web.spokes.map((points) => ({
        points,
        delayMs: web.delayMs,
        durationMs: 800,
      })),
      {
        points: web.silk,
        delayMs: web.delayMs + 800,
        durationMs: web.weaveMs,
      },
    ]),
  ].map((thread) => ({ ...thread, drawn: 0 }));
  let frame = 0;
  let stopped = false;
  let startTime: number | undefined;
  let lastBucket = -1;

  const draw = (time: number) => {
    let newSilk = false;
    silkContext.beginPath();
    context.beginPath();
    for (const thread of threads) {
      const progress = reducedMotion
        ? 1
        : progressAt(time, thread.delayMs, thread.durationMs);
      if (!progress) continue;
      const position = progress * (thread.points.length - 1);
      const completed = Math.floor(position);
      if (completed > thread.drawn) {
        newSilk = true;
        const from = thread.points[thread.drawn];
        silkContext.moveTo(from.x, from.y);
        for (let index = thread.drawn + 1; index <= completed; index++) {
          const point = thread.points[index];
          silkContext.lineTo(point.x, point.y);
        }
        thread.drawn = completed;
      }
      if (progress < 1) {
        const from = thread.points[completed];
        const tip = interpolate(
          from,
          thread.points[completed + 1],
          position - completed,
        );
        context.moveTo(from.x, from.y);
        context.lineTo(tip.x, tip.y);
      }
    }
    if (newSilk) silkContext.stroke();
    context.clearRect(0, 0, plan.width, plan.height);
    const fade = reducedMotion
      ? 1
      : 1 - progressAt(time, FADE_MS, END_MS - FADE_MS);
    context.globalAlpha = fade;
    context.drawImage(silk, 0, 0, plan.width, plan.height);
    context.globalAlpha = fade * 0.28;
    context.stroke();
    for (const [index, web] of plan.webs.entries()) {
      if (!reducedMotion && time < web.delayMs) continue;
      const weaving = reducedMotion
        ? 1
        : progressAt(time, web.delayMs + 800, web.weaveMs);
      let position = pointAt(web.silk, weaving);
      const escape = reducedMotion
        ? 0
        : progressAt(time, web.escapeDelayMs, web.escapeMs);
      if (escape >= 1) continue;
      if (escape > 0) {
        const from = web.silk[web.silk.length - 1];
        const eased = escape * escape * (3 - 2 * escape);
        position = {
          ...interpolate(from, web.escape, eased),
          angle: Math.atan2(web.escape.y - from.y, web.escape.x - from.x),
        };
      }
      context.save();
      context.globalAlpha = reducedMotion
        ? 1
        : Math.min(
            progressAt(time, web.delayMs, 350),
            1 - progressAt(escape, 0.85, 0.15),
          );
      context.translate(position.x, position.y);
      context.rotate(position.angle + Math.PI / 2);
      const walking = !reducedMotion && (weaving < 1 || escape > 0);
      const pose = walking
        ? (Math.floor(time / 110) + index) % sprites.length
        : 0;
      context.drawImage(
        sprites[pose],
        -web.spiderSize / 2,
        -web.spiderSize / 2,
        web.spiderSize,
        web.spiderSize,
      );
      context.restore();
    }
    context.globalAlpha = 1;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', stop);
    window.removeEventListener('scroll', stop, true);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('contextlost', stop);
    for (const surface of [canvas, silk, ...sprites]) {
      surface.width = 1;
      surface.height = 1;
    }
  };
  const onVisibility = () => {
    if (document.hidden) stop();
  };
  const tick = (timestamp: number) => {
    if (stopped) return;
    startTime ??= timestamp;
    const elapsed = timestamp - startTime;
    if (elapsed >= END_MS) {
      stop();
      return;
    }
    const bucket = Math.floor(elapsed / FRAME_MS);
    if (bucket > lastBucket) {
      lastBucket = bucket;
      draw(elapsed);
    }
    frame = requestAnimationFrame(tick);
  };
  window.addEventListener('resize', stop);
  window.addEventListener('scroll', stop, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('contextlost', stop);
  if (document.hidden) stop();
  else if (reducedMotion) draw(0);
  else frame = requestAnimationFrame(tick);
  return stop;
};
