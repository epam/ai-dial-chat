import type {
  RavenFragment,
  RavenSurface,
  RavenTargets,
} from './halloween-raven-targets';

export const RAVEN_SCENE_MS = 12000;
export const RAVEN_ROW_SECTIONS = 5;
export const RAVEN_GRAB = 0.25;
export const RAVEN_RELEASE = 0.56;
export const RAVEN_SHAKE = 0.77;
export const RAVEN_RESTORE = 0.95;

export interface RavenPoint {
  x: number;
  y: number;
}
export interface RavenFrame extends RavenPoint {
  offset: number;
  rotation: number;
  scale: number;
  opacity: number;
  /** Whether the segment arriving at this keyframe is airborne. */
  flying: boolean;
}
export interface RavenCargoFrame extends RavenPoint {
  offset: number;
  width: number;
  height: number;
  rotation: number;
  bend: number;
  opacity: number;
}
export interface RavenBird {
  facing: number;
  size: number;
  frames: RavenFrame[];
  perch: RavenPoint;
  pickup?: number;
  delivery?: number;
  material?: number;
}
export interface RavenFacingFrame {
  offset: number;
  facing: number;
  rotation: number;
}
export interface RavenMaterial extends RavenPoint {
  width: number;
  height: number;
  fragment?: RavenFragment;
  color: string;
  background: string;
}
export interface RavenPlan {
  width: number;
  height: number;
  nest: RavenPoint;
  nestWidth: number;
  birds: RavenBird[];
  cargo: RavenCargoFrame[];
  materials: RavenMaterial[];
  conversation: RavenSurface | null;
  pumpkin: RavenSurface | null;
  anchors: HTMLElement[];
  active: boolean;
}

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const between = (low: number, high: number) =>
  low + Math.random() * (high - low);

/** Orient the artwork along both axes; braced birds still face the prize they pull. */
export const ravenFacingFrames = (bird: RavenBird): RavenFacingFrame[] => {
  const frames: RavenFacingFrame[] = [];
  let facing = bird.facing;
  let rotation = bird.frames[0].rotation;
  for (let index = 0; index < bird.frames.length - 1; index++) {
    const from = bird.frames[index];
    const to = bird.frames[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const moving = dx !== 0 || dy !== 0;
    const direction = to.flying
      ? dx === 0
        ? facing
        : Math.sign(dx)
      : bird.facing;
    const pitch = to.flying
      ? moving
        ? (direction * Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI
        : rotation
      : from.rotation;
    if (index === 0) {
      facing = direction;
      rotation = pitch;
      frames.push({ offset: 0, facing, rotation });
    } else if (direction !== facing || pitch !== rotation) {
      const turn = Math.min(
        0.012,
        (from.offset - bird.frames[index - 1].offset) / 4,
        (to.offset - from.offset) / 4,
      );
      frames.push({ offset: from.offset - turn, facing, rotation });
      facing = direction;
      rotation = pitch;
      frames.push({ offset: from.offset + turn, facing, rotation });
    }
  }
  frames.push({ offset: 1, facing, rotation });
  return frames;
};

/** Every grip, section and carrier uses this same bowed row, including its rotation. */
export const ravenCargoPoint = (
  frame: RavenCargoFrame,
  fraction: number,
): RavenPoint => {
  const x = (fraction - 0.5) * frame.width;
  const y = Math.sin(Math.PI * fraction) * frame.bend;
  const angle = (frame.rotation * Math.PI) / 180;
  return {
    x: frame.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: frame.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
};

/** Geometry and timings are rolled once; the browser runs the resulting keyframes. */
export const buildRavenPlan = (
  targets: RavenTargets,
  isMobile: boolean,
): RavenPlan => {
  const width = Math.max(1, targets.width);
  const height = Math.max(1, targets.height);
  const birdSize = isMobile ? 54 : 66;
  const count = isMobile ? 5 : 8;
  const pumpkin = targets.pumpkin?.rect;
  const composer = targets.composer?.rect;
  const nest = {
    x: clamp(
      pumpkin
        ? pumpkin.left + pumpkin.width * 0.5
        : composer
          ? composer.right - 48
          : width * 0.7,
      54,
      Math.max(54, width - 54),
    ),
    y: clamp(
      pumpkin
        ? pumpkin.top + pumpkin.height * 0.3
        : composer
          ? composer.top
          : height * 0.72,
      66,
      Math.max(66, height - 55),
    ),
  };
  const source = targets.conversation?.rect;
  const originalWidth =
    source?.width ?? Math.min(180, (composer?.width ?? width) * 0.64);
  const originalHeight = source?.height ?? 8;
  const home = {
    x: source
      ? source.left + source.width / 2
      : composer
        ? composer.left + composer.width / 2
        : width / 2,
    y: source
      ? source.top + source.height / 2
      : (composer?.top ?? height * 0.4),
  };
  const tugWidth =
    Math.min(originalWidth, Math.max(80, width - birdSize * 2 - 40)) / 1.12;
  const room = tugWidth * 0.56 + birdSize + 8;
  const tug = {
    x: clamp(home.x + 24, room, Math.max(room, width - room)),
    y: clamp(home.y - 12, 76, Math.max(76, height - 120)),
  };
  const base: RavenCargoFrame = {
    offset: 0,
    ...home,
    width: originalWidth,
    height: originalHeight,
    rotation: 0,
    bend: 0,
    opacity: 0,
  };
  const cargo: RavenCargoFrame[] = [
    base,
    { ...base, offset: RAVEN_GRAB - 0.001 },
    { ...base, offset: RAVEN_GRAB, opacity: 1 },
    { ...base, ...tug, width: tugWidth, offset: 0.31, opacity: 1 },
    {
      ...base,
      ...tug,
      x: tug.x - 4,
      width: tugWidth * 1.015,
      bend: 3,
      offset: 0.355,
      opacity: 1,
    },
    {
      ...base,
      ...tug,
      x: tug.x + 4,
      width: tugWidth,
      bend: -3,
      offset: 0.395,
      opacity: 1,
    },
    {
      ...base,
      ...tug,
      x: tug.x - 9,
      width: tugWidth * 1.08,
      bend: 14,
      offset: 0.445,
      opacity: 1,
    },
    {
      ...base,
      ...tug,
      x: tug.x + 9,
      width: tugWidth * 1.03,
      bend: -9,
      offset: 0.49,
      opacity: 1,
    },
    {
      ...base,
      ...tug,
      width: tugWidth * 1.12,
      bend: 22,
      offset: RAVEN_RELEASE,
      opacity: 1,
    },
    {
      ...base,
      x: tug.x + (nest.x - tug.x) * 0.28,
      y: Math.max(44, tug.y - 110),
      width: tugWidth * 0.85,
      rotation: -16,
      bend: -12,
      offset: 0.615,
      opacity: 1,
    },
    {
      ...base,
      x: nest.x,
      y: Math.max(36, nest.y - 95),
      width: tugWidth * 0.5,
      height: originalHeight * 0.65,
      rotation: 14,
      bend: 4,
      offset: 0.685,
      opacity: 1,
    },
    {
      ...base,
      ...nest,
      y: nest.y - 2,
      width: 65,
      height: originalHeight * 0.45,
      rotation: -7,
      offset: 0.74,
      opacity: 1,
    },
    {
      ...base,
      ...nest,
      y: nest.y + 2,
      width: 65,
      height: originalHeight * 0.45,
      rotation: 6,
      offset: RAVEN_SHAKE,
      opacity: 1,
    },
    {
      ...base,
      x: nest.x - 10,
      y: nest.y - 34,
      width: 70,
      height: originalHeight * 0.5,
      rotation: -14,
      offset: 0.83,
      opacity: 1,
    },
    {
      ...base,
      x: (home.x + nest.x) / 2,
      y: Math.min(home.y, nest.y) - 60,
      width: originalWidth * 0.75,
      height: originalHeight * 0.75,
      rotation: 6,
      offset: 0.885,
      opacity: 1,
    },
    { ...base, offset: RAVEN_RESTORE, opacity: 1 },
    { ...base, offset: 0.985 },
    { ...base, offset: 1 },
  ];
  const birds: RavenBird[] = [0, 1].map((side) => {
    const grip = ravenCargoPoint(cargo[2], side);
    const facing = side ? -1 : 1;
    const frames: RavenFrame[] = [
      {
        offset: 0,
        x: side ? width + birdSize : -birdSize,
        y: Math.max(0, grip.y - 130),
        rotation: 0,
        scale: 1,
        opacity: 0,
        flying: true,
      },
      {
        offset: 0.09,
        x: grip.x + (side ? 24 : -24),
        y: Math.max(20, grip.y - 60),
        rotation: side ? 12 : -12,
        scale: 1,
        opacity: 1,
        flying: true,
      },
      {
        offset: 0.18,
        ...grip,
        rotation: 0,
        scale: 1,
        opacity: 1,
        flying: true,
      },
      ...cargo
        .filter(
          (f) =>
            f.offset >= RAVEN_GRAB && f.offset <= (side ? 0.74 : RAVEN_RELEASE),
        )
        .map((frame) => ({
          offset: frame.offset,
          ...ravenCargoPoint(frame, side),
          rotation: frame.rotation,
          scale: 1,
          opacity: 1,
          flying: frame.offset === 0.31 || frame.offset > RAVEN_RELEASE,
        })),
    ];
    const from = frames[frames.length - 1];
    frames.push(
      {
        ...from,
        offset: side ? 0.79 : 0.605,
        x: from.x + (side ? -26 : -45),
        y: Math.max(15, from.y - 85),
        rotation: side ? 25 : -24,
        flying: true,
      },
      {
        ...from,
        offset: 0.87,
        x: clamp(nest.x + (side ? -100 : 95), 30, width - 30),
        y: Math.max(25, nest.y - 120),
        rotation: side ? -15 : 18,
        flying: true,
      },
      {
        ...from,
        offset: 0.975,
        x: side ? -birdSize : width + birdSize,
        y: -birdSize,
        rotation: 0,
        opacity: 0,
        flying: true,
      },
      {
        ...from,
        offset: 1,
        x: -birdSize,
        y: -birdSize,
        opacity: 0,
        flying: true,
      },
    );
    return { facing, size: birdSize, frames, perch: grip };
  });
  const materials: RavenMaterial[] = targets.fragments
    .slice(0, count - 2)
    .map((fragment) => ({
      x: fragment.crop.left,
      y: fragment.crop.top,
      width: fragment.crop.width,
      height: fragment.crop.height,
      color: fragment.color,
      background: fragment.background,
      fragment,
    }));
  /* Sparse layouts use separated border corners; collectors never share a pickup. */
  for (const edge of targets.edges.filter(
    (edge) => edge !== targets.conversation,
  )) {
    for (const [horizontal, vertical] of [
      [0.08, 0],
      [0.78, 1],
      [0.08, 1],
      [0.78, 0],
    ]) {
      if (materials.length >= count - 2) break;
      const candidate: RavenMaterial = {
        x: edge.rect.left + edge.rect.width * horizontal,
        y: edge.rect.top + (edge.rect.height - 3) * vertical,
        width: Math.min(70, edge.rect.width * 0.2),
        height: 3,
        color: edge.color,
        background: edge.background,
      };
      if (
        materials.every(
          (material) =>
            Math.hypot(
              material.x +
                material.width / 2 -
                candidate.x -
                candidate.width / 2,
              material.y +
                material.height / 2 -
                candidate.y -
                candidate.height / 2,
            ) >= 96,
        )
      )
        materials.push(candidate);
    }
  }
  for (let index = 2; index < count; index++) {
    const worker = index - 2;
    const material = materials[worker];
    const pickup = 0.13 + worker * 0.058 + between(0, 0.008);
    const delivery = pickup + 0.19;
    const sourceX = material
      ? material.x + material.width / 2
      : (width * (worker + 1)) / (count - 1);
    const facing = sourceX > nest.x ? -1 : 1;
    const grip = {
      x: material ? material.x + (facing < 0 ? material.width : 0) : sourceX,
      y: material ? material.y + material.height / 2 : height * 0.22,
    };
    const perch = {
      x: clamp(grip.x, birdSize, width - birdSize),
      y: Math.max(30, grip.y - birdSize * 0.52),
    };
    const exit =
      worker % 3 === 0
        ? { x: -birdSize * 2, y: height * (0.18 + worker * 0.1) }
        : worker % 3 === 1
          ? { x: width + birdSize * 2, y: height * (0.18 + worker * 0.1) }
          : { x: (width * (worker + 1)) / (count - 1), y: -birdSize * 2 };
    const pose = (
      offset: number,
      point: RavenPoint,
      flying = true,
      opacity = 1,
    ): RavenFrame => ({
      offset,
      ...point,
      rotation: 0,
      scale: 1,
      opacity,
      flying,
    });
    const landing = { x: nest.x - 24 + worker * 8, y: nest.y - 5 };
    birds.push({
      size: birdSize * between(0.82, 0.94),
      facing,
      pickup: material ? pickup : undefined,
      delivery: material ? delivery : undefined,
      material: material ? worker : undefined,
      perch,
      frames: material
        ? [
            pose(0, exit, true, 0),
            pose(pickup - 0.07, { x: grip.x - facing * 10, y: grip.y - 45 }),
            pose(pickup, grip),
            pose(
              pickup + 0.025,
              { x: grip.x - facing * 4, y: grip.y - 3 },
              false,
            ),
            pose(pickup + 0.055, { x: grip.x + facing * 8, y: grip.y - 20 }),
            pose(pickup + 0.11, {
              x: grip.x + (nest.x - grip.x) * 0.45,
              y: Math.max(30, Math.min(grip.y, nest.y) - 90 - worker * 12),
            }),
            pose(delivery, landing),
            pose(delivery + 0.012, landing),
            pose(delivery + 0.06, {
              x: landing.x + (exit.x - landing.x) * 0.28,
              y: Math.max(24, landing.y - 90 - worker * 16),
            }),
            pose(delivery + 0.2, exit, true, 0),
            pose(1, exit, true, 0),
          ]
        : [
            pose(0, exit, true, 0),
            pose(0.2, perch),
            pose(0.66, perch, false),
            pose(0.88, exit, true, 0),
            pose(1, exit, true, 0),
          ],
    });
  }
  return {
    width,
    height,
    nest,
    nestWidth: pumpkin ? Math.min(112, pumpkin.width * 0.78) : 92,
    birds,
    cargo,
    materials,
    conversation: targets.conversation,
    pumpkin: targets.pumpkin,
    anchors: [
      ...new Set(
        [
          targets.composer,
          targets.pumpkin,
          targets.conversation,
          ...targets.edges,
          ...targets.fragments,
        ]
          .filter((target): target is RavenSurface => !!target)
          .map(({ element }) => element),
      ),
    ],
    active: !!(targets.composer || targets.conversation || targets.pumpkin),
  };
};
