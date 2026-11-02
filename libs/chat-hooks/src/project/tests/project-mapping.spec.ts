import {
  type ProjectDetailsDto,
  ProjectSource as ProjectSourceDto,
} from '@epam/ai-dial-chat-api-client';
import { ProjectSource } from '@epam/ai-dial-projects';
import { describe, expect, it } from 'vitest';
import {
  mapProjectDetailsToViewModel,
  mapProjectDtoToItem,
  mapStoredContextFiles,
} from '../project-mapping';

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

describe('mapProjectDetailsToViewModel', () => {
  const details = {
    ...dto,
    description: 'About',
    instructions: '## Steps',
    contextFiles: [
      { name: 'tickets.csv', size: 2048 },
      { name: 'survey.xlsx', size: 4096 },
      { name: 'blob', size: 1 },
    ],
    etag: '"e1"',
    contentVersion: '"cv1"',
    conversationCount: 0,
    canEdit: true,
  };

  it('keeps the texts and infers each context file type from its name', () => {
    expect(mapProjectDetailsToViewModel(details)).toEqual({
      name: 'alpha',
      description: 'About',
      instructions: '## Steps',
      contextFiles: [
        { name: 'tickets.csv', contentType: 'text/csv' },
        /* No known MIME type: left empty so the card labels it `.xlsx`, not `.bin`. */
        { name: 'survey.xlsx', contentType: '' },
        { name: 'blob', contentType: '' },
      ],
    });
  });
});

describe('mapStoredContextFiles', () => {
  it('labels a stored file whose extension has no known MIME type by its own extension', () => {
    const [csv, xlsx] = mapStoredContextFiles({
      contextFiles: [
        { name: 'tickets.csv', size: 2048 },
        { name: 'survey.xlsx', size: 14723 },
      ],
    } as ProjectDetailsDto);

    expect(csv).toMatchObject({
      id: 'stored:tickets.csv',
      contentType: 'text/csv',
      size: 2048,
      isStored: true,
    });
    /* Empty, not octet-stream, so the card labels it `.xlsx` rather than `.bin`. */
    expect(xlsx.contentType).toBe('');
  });
});
