import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsValidSkillPathLength } from '../dto/skill-path-length.validator';

class SkillReference {
  @IsValidSkillPathLength()
  skillUrl!: unknown;
}

describe('scheduled skill path length', () => {
  it.each(['a', '\u044f', '\u062a', '\u{1F4DA}', ' '])(
    'uses the same length limit for raw and encoded %s',
    (character) => {
      for (const encode of [(path: string) => path, encodeURIComponent]) {
        const reference = new SkillReference();
        reference.skillUrl = `skills/public/${encode(character.repeat(1024))}`;
        expect(validateSync(reference)).toEqual([]);
        reference.skillUrl = `skills/public/${encode(character.repeat(1025))}`;
        expect(validateSync(reference)).toHaveLength(1);
      }
    },
  );

  it.each([42, null, 'skills/public/%', 'skills/public/%FF'])(
    'rejects unmeasurable reference %j without throwing',
    (skillUrl) => {
      const reference = new SkillReference();
      reference.skillUrl = skillUrl;
      expect(validateSync(reference)).toHaveLength(1);
    },
  );
});
