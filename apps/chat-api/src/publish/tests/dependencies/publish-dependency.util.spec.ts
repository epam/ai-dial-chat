import { describe, expect, it } from 'vitest';
import {
  collectDependencies,
  isResourceInBucket,
  toResourceDependency,
} from '../../dependencies/publish-dependency.util';
import { ResourceDependencyType } from '../../dto/resource-dependency.dto';

describe('toResourceDependency', () => {
  it('returns nothing for a resource in the public bucket', () => {
    expect(toResourceDependency('prompts/public/Org/Shared')).toBeUndefined();
  });

  it('returns nothing for an id without a bucket, such as a built-in model', () => {
    expect(toResourceDependency('gpt-4o')).toBeUndefined();
  });

  it('returns nothing for a resource kind that is not listed', () => {
    expect(toResourceDependency('conversations/b/chat')).toBeUndefined();
  });

  it('returns nothing for a url with no path after the bucket', () => {
    expect(toResourceDependency('prompts/b/')).toBeUndefined();
  });

  it('maps a prompt in a nested folder, decoding name and location', () => {
    expect(
      toResourceDependency('prompts/b/Support%20team/Greeting%20v2'),
    ).toEqual({
      id: 'prompts/b/Support%20team/Greeting%20v2',
      name: 'Greeting v2',
      type: ResourceDependencyType.Prompt,
      location: 'Support team',
    });
  });

  it('splits the version off an application and a toolset', () => {
    expect(
      toResourceDependency('applications/b/Research%20agent__2.0.0'),
    ).toEqual({
      id: 'applications/b/Research%20agent__2.0.0',
      name: 'Research agent',
      version: '2.0.0',
      type: ResourceDependencyType.Application,
      location: '',
    });
    expect(toResourceDependency('toolsets/b/Team/Search__1.0.0')).toMatchObject(
      {
        name: 'Search',
        version: '1.0.0',
        type: ResourceDependencyType.Toolset,
        location: 'Team',
      },
    );
  });

  it('keeps a double underscore in the name of an unversioned kind', () => {
    expect(toResourceDependency('skills/b/my__skill')).toMatchObject({
      name: 'my__skill',
      type: ResourceDependencyType.Skill,
    });
    expect(toResourceDependency('skills/b/my__skill')?.version).toBeUndefined();
  });

  it('drops a fragment and reads a legacy metadata folder url as a file dependency', () => {
    expect(
      toResourceDependency('files/b/docs/report.pdf#page=2'),
    ).toMatchObject({
      id: 'files/b/docs/report.pdf',
      name: 'report.pdf',
      location: 'docs',
      type: ResourceDependencyType.File,
    });
    expect(toResourceDependency('metadata/files/b/docs/')).toMatchObject({
      name: 'docs',
      location: '',
      type: ResourceDependencyType.File,
    });
  });
});

describe('collectDependencies', () => {
  it('collapses duplicates by id and keeps the first-seen order', () => {
    const result = collectDependencies([
      'skills/b/B',
      'prompts/public/Shared',
      'prompts/b/A',
      'skills/b/B',
    ]);
    expect(result.map((dependency) => dependency.id)).toEqual([
      'skills/b/B',
      'prompts/b/A',
    ]);
  });

  it('keeps entries with different ids', () => {
    expect(
      collectDependencies(['prompts/b/A', 'prompts/c/A']).map(
        (dependency) => dependency.id,
      ),
    ).toEqual(['prompts/b/A', 'prompts/c/A']);
  });
});

describe('collectDependencies with a legacy folder url', () => {
  it('lists one folder once however it is stored', () => {
    const result = collectDependencies([
      'files/b/docs/',
      'metadata/files/b/docs/',
    ]);
    expect(result.map(({ id }) => id)).toEqual(['files/b/docs/']);
  });
});

describe('isResourceInBucket', () => {
  it('compares the decoded bucket segment', () => {
    expect(isResourceInBucket('files/bucket%2D1/a.txt', 'bucket-1')).toBe(true);
    expect(isResourceInBucket('files/other/a.txt', 'bucket-1')).toBe(false);
  });

  it('ignores a legacy metadata prefix', () => {
    expect(isResourceInBucket('metadata/files/b/docs/', 'b')).toBe(true);
  });
});
