/** Shared drawing coordinates keep short sleeves, hands and carried props aligned. */
export const ELF_RIG = {
  shoulder: { x: 17, y: -56 },
  upperArmLength: 18,
  palm: { x: 19, y: 0 },
  reel: { x: -25, y: -35 },
  head: { x: 0, y: -66 },
  cap: { x: 0, y: -94 },
  legPivotY: -22,
};

const rad = (angle: number) => (angle * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Palm position of an elf's arm in its native frame, for absolute upper-arm and relative forearm angles in degrees. */
export const elfPalm = (upper: number, forearm: number): [number, number] => {
  const u = rad(upper);
  const f = rad(upper + forearm);
  return [
    ELF_RIG.shoulder.x +
      ELF_RIG.upperArmLength * Math.cos(u) +
      ELF_RIG.palm.x * Math.cos(f),
    ELF_RIG.shoulder.y +
      ELF_RIG.upperArmLength * Math.sin(u) +
      ELF_RIG.palm.x * Math.sin(f),
  ];
};

/** Returns the upper-arm and forearm angles that bring an elf's palm to `target`, elbow down, clamped to the arm's reach. */
export const elfReach = ([x, y]: [number, number]): [number, number] => {
  const l1 = ELF_RIG.upperArmLength;
  const l2 = ELF_RIG.palm.x;
  const dx = x - ELF_RIG.shoulder.x;
  const dy = y - ELF_RIG.shoulder.y;
  const d = Math.min(
    l1 + l2 - 0.01,
    Math.max(Math.abs(l1 - l2) + 0.5, Math.hypot(dx, dy)),
  );
  const toTarget = Math.atan2(dy, dx);
  const bend = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const upper = toTarget + bend;
  const fore = Math.atan2(
    d * Math.sin(toTarget) - l1 * Math.sin(upper),
    d * Math.cos(toTarget) - l1 * Math.cos(upper),
  );
  return [deg(upper), deg(fore - upper)];
};
