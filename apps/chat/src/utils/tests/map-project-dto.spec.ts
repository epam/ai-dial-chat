import { ProjectSource as ProjectSourceDto } from '@epam/ai-dial-chat-api-client';
import { ProjectSource } from '@epam/ai-dial-projects';
import { describe, expect, it } from 'vitest';
import { mapProjectDtoToItem } from '../map-project-dto';

const dto = {
  id: 'projects/b/alpha',
  name: 'alpha',
  bucket: 'b',
  path: 'alpha',
  source: ProjectSourceDto.Personal,
};

describe('mapProjectDtoToItem', () => {
  it('keeps the id and name and uses the update time', () => {
    expect(mapProjectDtoToItem({ ...dto, createdAt: 1, updatedAt: 2 })).toEqual(
      {
        id: 'projects/b/alpha',
        name: 'alpha',
        source: ProjectSource.Personal,
        updatedAt: 2,
      },
    );
  });

  it('keeps the grouping folder path for the card folder path', () => {
    expect(
      mapProjectDtoToItem({ ...dto, parentPath: 'marketing/2026' }).parentPath,
    ).toBe('marketing/2026');
  });

  it('falls back to the creation time when the update time is missing', () => {
    expect(mapProjectDtoToItem({ ...dto, createdAt: 1 }).updatedAt).toBe(1);
  });

  it('leaves the date unset when neither time is present', () => {
    expect(mapProjectDtoToItem(dto).updatedAt).toBeUndefined();
  });

  it.each([
    [ProjectSourceDto.Personal, ProjectSource.Personal],
    [ProjectSourceDto.Shared, ProjectSource.Shared],
    [ProjectSourceDto.Organization, ProjectSource.Organization],
  ])('maps the %s source onto the lib source', (source, expected) => {
    expect(mapProjectDtoToItem({ ...dto, source }).source).toBe(expected);
  });
});
