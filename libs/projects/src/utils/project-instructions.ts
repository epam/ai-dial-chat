/** Upper bound of a project's Instructions, in Unicode code points (the BFF limit). */
export const PROJECT_INSTRUCTIONS_MAX_LENGTH = 32000;

/** Returns whether `instructions` exceeds {@link PROJECT_INSTRUCTIONS_MAX_LENGTH} code points. */
export const isProjectInstructionsTooLong = (instructions: string): boolean => {
  /* UTF-16 length is at least the code point count, so a short string needs no iteration. */
  if (instructions.length <= PROJECT_INSTRUCTIONS_MAX_LENGTH) return false;
  let count = 0;
  for (const _ of instructions) {
    count += 1;
    if (count > PROJECT_INSTRUCTIONS_MAX_LENGTH) return true;
  }
  return false;
};
