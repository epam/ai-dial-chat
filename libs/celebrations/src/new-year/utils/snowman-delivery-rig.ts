/** A point in native snowman units or viewport pixels. */
export type Point = [number, number];

/**
 * Snowman geometry in native units shared by the artwork, the composition
 * and the card track. The ground is y = 0, y grows downward and the snowman
 * faces +x; the scene mirrors x for travel toward −x.
 */
export const SNOWMAN_RIG = {
  footBack: [-10, -3] as Point,
  footFront: [11, -3] as Point,
  footRadius: [9, 4] as Point,
  bottomBall: { center: [0, -33] as Point, radius: 28 },
  middleBall: { center: [0, -75] as Point, radius: 20 },
  neck: [0, -93] as Point,
  /** Head centre relative to the neck socket. */
  headOffset: [0, -14] as Point,
  headRadius: 15,
  /** Carrot base and tip relative to the head centre. */
  carrotBase: [12, -1] as Point,
  carrotTip: [30, 1] as Point,
  shoulderFront: [5, -80] as Point,
  shoulderBack: [-5, -82] as Point,
  upperArm: 26,
  lowerArm: 24,
  /** Mitten grip beyond the wrist, along the forearm. */
  gripReach: 5,
  /** Bottom of the lower ball: rests on the seat while sitting. */
  seat: [0, -5] as Point,
  /** Highest mitten grip on tiptoe with both arms raised. */
  reach: 128,
  /** Height band the standing cast needs above its floor. */
  castHeight: 150,
  baseWidth: 56,
  /** Width and height of the drawn sled used when no card is borrowed. */
  sledSize: [70, 16] as Point,
} as const;

/** Scene scale of one native unit, in CSS pixels. */
export const SNOWMAN_SCALE = { desktop: 0.9, mobile: 0.68 } as const;

/** Elbow bend limits of the stick arms, in degrees. */
export const ELBOW_RANGE = { min: 20, max: 140 } as const;

/**
 * Sled motion constants shared by staging and choreography: the two pushes
 * cover `pushShare` of the travel, then the sled glides from a small speed
 * with constant acceleration for `glideSeconds` until the snowbank stops it.
 */
export const SNOWMAN_SLIDE = {
  pushShare: 0.1,
  glideSeconds: 2.4,
  startSpeedShare: 0.15,
} as const;

/** Bounds of the detached head's flight time, in seconds. */
export const HEAD_FLIGHT = { min: 0.35, nominal: 0.5, max: 0.6 } as const;

/** Sled speed at the snowbank for a travel of `length`. */
export const glideEndSpeed = (length: number): number => {
  const { pushShare, glideSeconds, startSpeedShare } = SNOWMAN_SLIDE;
  return (
    (length * (1 - pushShare) * (startSpeedShare + 2 * (1 - startSpeedShare))) /
    glideSeconds
  );
};

/** Position of the glide at `phase` ∈ [0, 1] as a share of its length. */
export const glideProgress = (phase: number): number => {
  const { startSpeedShare } = SNOWMAN_SLIDE;
  return startSpeedShare * phase + (1 - startSpeedShare) * phase * phase;
};

const degrees = (radians: number) => (radians * 180) / Math.PI;
const radians = (angle: number) => (angle * Math.PI) / 180;

/** Elbow and grip of a stick arm whose upper segment points at `upper` degrees and bends by `bend` degrees. */
export const armPose = (
  shoulder: Point,
  upper: number,
  bend: number,
): { elbow: Point; wrist: Point; grip: Point } => {
  const { upperArm, lowerArm, gripReach } = SNOWMAN_RIG;
  const a = radians(upper);
  const b = radians(upper + bend);
  const elbow: Point = [
    shoulder[0] + upperArm * Math.cos(a),
    shoulder[1] + upperArm * Math.sin(a),
  ];
  const wrist: Point = [
    elbow[0] + lowerArm * Math.cos(b),
    elbow[1] + lowerArm * Math.sin(b),
  ];
  const grip: Point = [
    wrist[0] + gripReach * Math.cos(b),
    wrist[1] + gripReach * Math.sin(b),
  ];
  return { elbow, wrist, grip };
};

/**
 * Upper-arm direction and elbow bend that put the grip on `target`, with
 * the bend clamped to {@link ELBOW_RANGE}; `bendSign` picks the elbow side.
 */
export const reachArm = (
  shoulder: Point,
  target: Point,
  bendSign: 1 | -1 = 1,
): { upper: number; bend: number } => {
  const { upperArm, lowerArm, gripReach } = SNOWMAN_RIG;
  const forearm = lowerArm + gripReach;
  const dx = target[0] - shoulder[0];
  const dy = target[1] - shoulder[1];
  const span = Math.hypot(dx, dy);
  const min = Math.sqrt(
    upperArm ** 2 +
      forearm ** 2 -
      2 * upperArm * forearm * Math.cos(radians(180 - ELBOW_RANGE.max)),
  );
  const max = Math.sqrt(
    upperArm ** 2 +
      forearm ** 2 -
      2 * upperArm * forearm * Math.cos(radians(180 - ELBOW_RANGE.min)),
  );
  const distance = Math.min(max, Math.max(min, span));
  const inner = Math.acos(
    (upperArm ** 2 + forearm ** 2 - distance ** 2) / (2 * upperArm * forearm),
  );
  const bend = 180 - degrees(inner);
  const offset = Math.acos(
    (upperArm ** 2 + distance ** 2 - forearm ** 2) / (2 * upperArm * distance),
  );
  const upper = degrees(Math.atan2(dy, dx)) - bendSign * degrees(offset);
  return { upper, bend: bendSign * bend };
};
