import {
  getFileNameExtension,
  getFileNameWithoutExtension,
} from '@epam/ai-dial-chat-shared';

const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns a deduplicated filename if `name` already exists in `existingNames`. */
export const getNextFileName = (
  name: string,
  existingNames: string[],
): string => {
  if (!existingNames.includes(name)) {
    return name;
  }

  const base = getFileNameWithoutExtension(name);
  const ext = getFileNameExtension(name);
  const prefix = `${base} `;
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);

  const usedNumbers = existingNames
    .filter((n) => {
      const b = getFileNameWithoutExtension(n);
      const e = getFileNameExtension(n);
      return e === ext && b.match(regex);
    })
    .map((n) => {
      const b = getFileNameWithoutExtension(n);
      const m = b.match(regex);
      return m ? parseInt(m[1], 10) : 0;
    });

  const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `${prefix}${next}${ext}`;
};
