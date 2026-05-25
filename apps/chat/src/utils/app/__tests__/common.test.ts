import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  addTrailingSlashIfAbsent,
  arraysHaveSameElements,
  buildContentWithTranscriptAtSelection,
  combineEntities,
  doesHaveDotsInTheEnd,
  extractNameFromEmail,
  filterMigratedEntities,
  filterOnlyMyEntities,
  findLatestVersion,
  getDefaultConversationProps,
  getDefaultEntityProps,
  getLastPathSegment,
  getSafeRedirectUrl,
  getTranscriptTextToInsert,
  groupAllVersions,
  hasInvalidNameInPath,
  isEntityNameInvalid,
  isEntityNameOnSameLevelUnique,
  isEntityNameOrPathInvalid,
  isEntityNameValid,
  isImportEntityNameOnSameLevelUnique,
  isSearchFilterMatched,
  isSectionFilterMatched,
  isVersionExists,
  isVersionFilterMatched,
  isVersionPartSizeValid,
  isVersionValid,
  parseCommaSeparatedList,
  prepareEntityName,
  replaceSpacesFromString,
  replaceStringRange,
  sortItemsVersions,
  trimEndDots,
} from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';

import { ApiKeys } from '@/src/types/common';
import {
  PublicVersionGroups,
  PublicVersionOption,
} from '@/src/types/publication';

import { NA_VERSION } from '@/src/constants/publication';

import { Entity, ShareEntity } from '@epam/ai-dial-shared';

const bucket = 'my-bucket';
beforeAll(() => {
  BucketService.setBucket(bucket);
});

describe('utils/app/common.ts', () => {
  describe('combineEntities', () => {
    const entity1 = {
      id: `${ApiKeys.Prompts}/${bucket}/entity1`,
      name: 'entity1',
      folderId: `${ApiKeys.Prompts}/${bucket}`,
    };
    const entity2 = {
      id: `${ApiKeys.Prompts}/${bucket}/entity2`,
      name: 'entity2',
      folderId: `${ApiKeys.Prompts}/${bucket}`,
    };
    const entity3 = { ...entity2, name: 'entity3' };

    it('Should return combined entities if ids are not the same', () => {
      expect(combineEntities([entity1], [entity2])).toHaveLength(2);
    });
    it('Should replace entities with new ones if ids collide', () => {
      const res = combineEntities([entity1, entity2], [entity3]);

      expect(res).toHaveLength(2);
      expect(res.find(({ id }) => id === entity3.id)?.name).toBe(entity3.name);
    });
  });

  describe('Name uniqueness helpers', () => {
    const entity = {
      id: `${ApiKeys.Prompts}/${bucket}/entity1`,
      name: 'entity1',
      folderId: `${ApiKeys.Prompts}/${bucket}`,
    };
    const entities = [
      {
        id: `${ApiKeys.Prompts}/${bucket}/test/entity1`,
        name: 'entity1',
        folderId: `${ApiKeys.Prompts}/${bucket}/test`,
      },
      {
        id: `${ApiKeys.Prompts}/${bucket}/entity2`,
        name: 'entity2',
        folderId: `${ApiKeys.Prompts}/${bucket}`,
      },
    ];

    it('isEntityNameOnSameLevel: Should return true if there is no entity on the same level with the same name', () => {
      expect(isEntityNameOnSameLevelUnique('entity1', entity, entities)).toBe(
        true,
      );
    });

    it('isImportEntityNameOnSameLevelUnique: Should return true if there is no entity on the same level with the same name, parentPath and apiKey', () => {
      expect(isImportEntityNameOnSameLevelUnique({ entity, entities })).toBe(
        true,
      );
      expect(
        isImportEntityNameOnSameLevelUnique({
          entity,
          entities: [...entities, entity],
        }),
      ).toBe(false);
    });
  });

  describe('Name validation helpers', () => {
    it('doesHaveDotsInTheEnd: trims then checks dot at end', () => {
      expect(doesHaveDotsInTheEnd('abc.')).toBe(true);
      expect(doesHaveDotsInTheEnd('abc.   ')).toBe(true);
      expect(doesHaveDotsInTheEnd('abc')).toBe(false);
    });

    it('isEntityNameInvalid: invalid if has disallowed symbols or ends with dot (by default)', () => {
      expect(isEntityNameInvalid('bad,')).toBe(true);
      expect(isEntityNameInvalid('abc.')).toBe(true);
      expect(isEntityNameInvalid('abc.', false)).toBe(false);
      expect(isEntityNameInvalid('abc')).toBe(false);
    });

    it('isEntityNameValid: trims + checks invalid + length limits', () => {
      expect(isEntityNameValid('  ')).toBe(false);
      expect(isEntityNameValid(' a ')).toBe(true);
      expect(isEntityNameValid(' ab ')).toBe(true);
      expect(isEntityNameValid('ab,')).toBe(false);
      expect(isEntityNameValid('abc.', { checkDotsInTheEnd: true })).toBe(
        false,
      );
      expect(isEntityNameValid('abc.', { checkDotsInTheEnd: false })).toBe(
        true,
      );
    });

    it('isEntityNameValid: applies maxBytes using UTF-8 length', () => {
      expect(isEntityNameValid('я'.repeat(3), { maxBytes: 6 })).toBe(true);
      expect(isEntityNameValid('я'.repeat(3), { maxBytes: 5 })).toBe(false);
    });

    it('hasInvalidNameInPath: checks every path segment', () => {
      expect(hasInvalidNameInPath('ok/bad,/ok')).toBe(true);
      expect(hasInvalidNameInPath('ok/ok/ok')).toBe(false);
    });

    it('isEntityNameOrPathInvalid: combines entity.name invalid OR folderId path invalid', () => {
      const validEntity = { id: '1', name: 'Valid', folderId: 'ok/ok' };
      const invalidName = { id: '2', name: 'Bad,', folderId: 'ok/ok' };
      const invalidPath = { id: '3', name: 'Good', folderId: 'ok/bad,/ok' };

      expect(isEntityNameOrPathInvalid(validEntity)).toBe(false);
      expect(isEntityNameOrPathInvalid(invalidName)).toBe(true);
      expect(isEntityNameOrPathInvalid(invalidPath)).toBe(true);
    });
  });

  describe('filtering helpers', () => {
    it('filterOnlyMyEntities: filters out entities sharedWithMe or publishedWithMe', () => {
      const items = [
        { id: '1', sharedWithMe: false, publishedWithMe: false } as ShareEntity,
        { id: '2', sharedWithMe: true, publishedWithMe: false } as ShareEntity,
        { id: '3', sharedWithMe: false, publishedWithMe: true } as ShareEntity,
      ];

      expect(filterOnlyMyEntities(items).map((x) => x.id)).toEqual(['1']);
    });

    it('filterMigratedEntities: keeps only migrated by default, or non-migrated when flag is true', () => {
      const entities = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Entity[];
      const migrated = ['a', 'c'];

      expect(
        filterMigratedEntities(entities, migrated).map((e) => e.id),
      ).toEqual(['a', 'c']);
      expect(
        filterMigratedEntities(entities, migrated, true).map((e) => e.id),
      ).toEqual(['b']);
    });
  });

  describe('string helpers', () => {
    it('trimEndDots: removes trailing dots and whitespace', () => {
      expect(trimEndDots('abc...')).toBe('abc');
      expect(trimEndDots('abc. \n\t')).toBe('abc');
      expect(trimEndDots('abc')).toBe('abc');
    });

    it('replaceSpacesFromString: replaces disallowed spaces to a single space, returns empty string for undefined', () => {
      expect(replaceSpacesFromString('a b\tc')).toBe('a b c');
      expect(replaceSpacesFromString(undefined)).toBe('');
    });

    it('prepareEntityName: forRenaming=true replaces disallowed symbols with "" by default and trims', () => {
      expect(prepareEntityName('  ab,c  ', { forRenaming: true })).toBe('abc');
    });

    it('prepareEntityName: forRenaming=true + replaceWithSpacesForRenaming uses "_" replacementChar', () => {
      expect(
        prepareEntityName('  ab,c  ', {
          forRenaming: true,
          replaceWithSpacesForRenaming: true,
        }),
      ).toBe('ab_c');
    });

    it('prepareEntityName: forRenaming=false picks first non-empty line after cleaning', () => {
      const input = ' \n\n  bad,line  \n  ok#line2  ';
      expect(prepareEntityName(input, { forRenaming: false })).toBe('bad_line');
    });

    it('prepareEntityName: respects maxNameLength and trims end dots by default', () => {
      expect(prepareEntityName('abcdefg....', { maxNameLength: 5 })).toBe(
        'abcde',
      );
    });

    it('prepareEntityName: forRenaming=true does NOT trim end dots unless trimEndDotsRequired=true', () => {
      expect(prepareEntityName('abc....', { forRenaming: true })).toBe(
        'abc....',
      );
      expect(
        prepareEntityName('abc....', {
          forRenaming: true,
          trimEndDotsRequired: true,
        }),
      ).toBe('abc');
    });

    it('replaceStringRange: replaces [start, end) range', () => {
      expect(replaceStringRange('hello world', 'X', 6, 11)).toBe('hello X');
    });

    describe('getTranscriptTextToInsert', () => {
      it('returns empty string when transcript is whitespace only', () => {
        expect(getTranscriptTextToInsert('hello', '   \n  ')).toBe('');
      });

      it('returns trimmed transcript when nothing precedes cursor', () => {
        expect(getTranscriptTextToInsert('', '  hi there ')).toBe('hi there');
      });

      it('returns trimmed transcript when preceding text is whitespace only', () => {
        expect(getTranscriptTextToInsert('   ', 'hi')).toBe('hi');
      });

      it('prepends a space when preceding text ends without a space', () => {
        expect(getTranscriptTextToInsert('hello', 'world')).toBe(' world');
      });

      it('does not prepend a space when preceding text already ends with a space', () => {
        expect(getTranscriptTextToInsert('hello ', 'world')).toBe('world');
      });
    });

    describe('buildContentWithTranscriptAtSelection', () => {
      it('inserts transcript at the cursor with leading space when needed', () => {
        expect(
          buildContentWithTranscriptAtSelection('hello world', 'there', {
            start: 5,
            end: 5,
          }),
        ).toBe('hello there world');
      });

      it('replaces the selected range with the transcript', () => {
        expect(
          buildContentWithTranscriptAtSelection('hello brave world', 'new', {
            start: 6,
            end: 11,
          }),
        ).toBe('hello new world');
      });

      it('appends without leading space when text already ends with a space', () => {
        expect(
          buildContentWithTranscriptAtSelection('hello ', 'world', {
            start: 6,
            end: 6,
          }),
        ).toBe('hello world');
      });

      it('returns the input when the transcript is empty', () => {
        expect(
          buildContentWithTranscriptAtSelection('hello', '   ', {
            start: 5,
            end: 5,
          }),
        ).toBe('hello');
      });

      it('clamps out-of-range selection indices to the input length', () => {
        expect(
          buildContentWithTranscriptAtSelection('hi', 'there', {
            start: 50,
            end: 80,
          }),
        ).toBe('hi there');
      });
    });

    it('getLastPathSegment: returns last segment or empty string', () => {
      expect(getLastPathSegment('a/b/c')).toBe('c');
      expect(getLastPathSegment('a/b/')).toBe('');
      expect(getLastPathSegment('')).toBe('');
    });

    it('addTrailingSlashIfAbsent: appends slash when missing', () => {
      expect(addTrailingSlashIfAbsent('a/b')).toBe('a/b/');
      expect(addTrailingSlashIfAbsent('a/b/')).toBe('a/b/');
    });
  });

  describe('search & filter match helpers', () => {
    it('isSearchFilterMatched: uses provided searchFilter', () => {
      const filters = { searchFilter: (e: ShareEntity) => e.id === '1' };
      expect(isSearchFilterMatched({ id: '1' } as ShareEntity, filters)).toBe(
        true,
      );
      expect(isSearchFilterMatched({ id: '2' } as ShareEntity, filters)).toBe(
        false,
      );
    });

    it('isSectionFilterMatched: ignoreSectionFilter=true forces true', () => {
      const filters = { sectionFilter: () => false };
      expect(
        isSectionFilterMatched({ id: '1' } as ShareEntity, filters, true),
      ).toBe(true);
    });

    it('isSectionFilterMatched: uses provided sectionFilter', () => {
      const filters = { sectionFilter: (e: ShareEntity) => e.id === '1' };
      expect(isSectionFilterMatched({ id: '1' } as ShareEntity, filters)).toBe(
        true,
      );
      expect(isSectionFilterMatched({ id: '2' } as ShareEntity, filters)).toBe(
        false,
      );
    });

    it('isVersionFilterMatched: ignoreVersionFilter=true forces true', () => {
      const filters = { versionFilter: () => false };
      expect(
        isVersionFilterMatched({ id: '1' } as ShareEntity, filters, {}, true),
      ).toBe(true);
    });

    it('isVersionFilterMatched: returns true if entity has no version or filters.versionFilter missing', () => {
      const filters = { versionFilter: () => false };
      expect(
        isVersionFilterMatched({ id: 'x' } as ShareEntity, filters, {}),
      ).toBe(true);
      expect(
        isVersionFilterMatched(
          { id: 'x', publicationInfo: { version: '1.0.0' } } as ShareEntity,
          {},
          {},
        ),
      ).toBe(true);
    });

    it('isVersionFilterMatched: returns true when versionGroups has no entry for entity', () => {
      const entity = {
        id: 'x',
        publicationInfo: { version: '1.0.0' },
      } as ShareEntity;
      const filters = { versionFilter: () => false };
      expect(isVersionFilterMatched(entity, filters, {})).toBe(true);
    });

    it('isVersionFilterMatched: uses versionGroups selectedVersion when group exists', () => {
      const entityIdWithoutVersion = `${ApiKeys.Prompts}/${bucket}/test`;
      const entity = {
        id: `${entityIdWithoutVersion}__2.0.0`,
        publicationInfo: { version: '2.0.0' },
      } as ShareEntity;

      const versionGroups: PublicVersionGroups = {
        [entityIdWithoutVersion]: {
          selectedVersion: { version: '2.0.0', id: entity.id },
          allVersions: [{ version: '2.0.0', id: entity.id }],
        },
      };

      const versionFilter = vi.fn().mockReturnValue(true);
      const filters = { versionFilter };

      expect(isVersionFilterMatched(entity, filters, versionGroups)).toBe(true);
      expect(versionFilter).toHaveBeenCalledWith(entity, '2.0.0');
    });
  });

  describe('version helpers', () => {
    it('isVersionValid', () => {
      expect(isVersionValid(undefined)).toBe(false);
      expect(isVersionValid('1.2')).toBe(false);
      expect(isVersionValid('1.2.3')).toBe(true);
      expect(isVersionValid('1.2.x')).toBe(false);
      expect(isVersionValid('01.002.0003')).toBe(true);
    });

    it('isVersionPartSizeValid', () => {
      expect(isVersionPartSizeValid(undefined)).toBe(false);
      expect(isVersionPartSizeValid('123456.1.1')).toBe(false);
      expect(isVersionPartSizeValid('12345.12345.12345')).toBe(true);
    });

    it('isVersionExists: builds new entity id and checks publicVersionGroups allVersions', () => {
      const entityId = `${ApiKeys.Conversations}/${bucket}/parent/path/model__old`;
      const newName = 'new';
      const versionToTest = '1.0.0';

      const expectedNewEntityId = `${ApiKeys.Conversations}/public/parent/path/model__${newName}`;

      const publicVersionGroups: PublicVersionGroups = {
        [expectedNewEntityId]: {
          allVersions: [
            { version: '0.9.0', id: entityId },
            { version: '1.0.0', id: entityId },
          ],
          selectedVersion: { version: '1.0.0', id: entityId },
        },
      };

      expect(
        isVersionExists(versionToTest, entityId, publicVersionGroups, newName),
      ).toBe(true);

      expect(
        isVersionExists('2.0.0', entityId, publicVersionGroups, newName),
      ).toBe(false);
    });

    it('isVersionExists: for non-conversation apiKey uses newName as the last segment', () => {
      const entityId = `${ApiKeys.Prompts}/bkt/parent/path/oldName`;
      const newName = 'renamed';

      const expectedNewEntityId = `${ApiKeys.Prompts}/public/parent/path/${newName}`;

      const publicVersionGroups: PublicVersionGroups = {
        [expectedNewEntityId]: {
          allVersions: [{ version: '3.3.3', id: entityId }],
          selectedVersion: { version: '3.3.3', id: entityId },
        },
      };

      expect(
        isVersionExists('3.3.3', entityId, publicVersionGroups, newName),
      ).toBe(true);
    });

    it('findLatestVersion: returns NA_VERSION when list empty or only NA_VERSION', () => {
      expect(findLatestVersion([])).toBe(NA_VERSION);
      expect(findLatestVersion([NA_VERSION])).toBe(NA_VERSION);
    });

    it('findLatestVersion: returns latest numeric version', () => {
      expect(findLatestVersion(['0.9.0', '1.10.0', '1.2.3'])).toBe('1.10.0');
    });

    it('sortItemsVersions: sorts descending by version; NA/undefined are placed at the end', () => {
      const items = [
        { id: 'a', version: '1.0.0' },
        { id: 'b', version: '2.0.0' },
        { id: 'c', version: 'N/A' },
        { id: 'd', version: undefined },
        { id: 'e', version: '1.10.0' },
      ];

      const res = sortItemsVersions(items);

      expect(res.map((x) => x.id)).toEqual(['b', 'e', 'a', 'c', 'd']);
    });

    it('groupAllVersions: groups by major.minor and returns latest version per group with its id', () => {
      const versions: PublicVersionOption[] = [
        { id: 'a', version: '1.0.1' },
        { id: 'b', version: '1.0.9' },
        { id: 'c', version: '1.1.0' },
        { id: 'd', version: '1.1.3' },
        { id: 'e', version: '2.0.0' },
      ];

      const res = groupAllVersions(versions);

      expect(res).toEqual(
        expect.arrayContaining([
          { version: '1.0.9', id: 'b' },
          { version: '1.1.3', id: 'd' },
          { version: '2.0.0', id: 'e' },
        ]),
      );
      expect(res).toHaveLength(3);
    });
  });

  describe('misc helpers', () => {
    it('extractNameFromEmail: extracts local part only for valid email-like strings', () => {
      expect(extractNameFromEmail(undefined)).toBeUndefined();
      expect(extractNameFromEmail('palina@example.com')).toBe('palina');
      expect(extractNameFromEmail('palina@example')).toBe('palina@example');
      expect(extractNameFromEmail('palina @@@')).toBe('palina @@@');
      expect(extractNameFromEmail('palina @ test')).toBe('palina @ test');
      expect(extractNameFromEmail('palina@')).toBe('palina@');
      expect(extractNameFromEmail('palina@q')).toBe('palina@q');
      expect(
        extractNameFromEmail(
          'OpenAI"s o3-mini is a cost-efficient reasoning model optimized for coding, math, and science tasks, offering faster responses and improved accuracy over its predecessors.',
        ),
      ).toBe(
        'OpenAI"s o3-mini is a cost-efficient reasoning model optimized for coding, math, and science tasks, offering faster responses and improved accuracy over its predecessors.',
      );
      expect(extractNameFromEmail("test_user10_(\\~!@#$^*-_+[]'|<>.?)")).toBe(
        "test_user10_(\\~!@#$^*-_+[]'|<>.?)",
      );
    });

    it('parseCommaSeparatedList: trims items; returns default when undefined', () => {
      expect(parseCommaSeparatedList('a, b ,c')).toEqual(['a', 'b', 'c']);
      expect(parseCommaSeparatedList(undefined)).toEqual([]);
      expect(parseCommaSeparatedList(undefined, ['x'])).toEqual(['x']);
      expect(
        parseCommaSeparatedList('123,234\\,345\\,456,567\\,678,789'),
      ).toEqual(['123', '234,345,456', '567,678', '789']);
    });

    it('arraysHaveSameElements: true when arrays have same multiset of elements', () => {
      expect(arraysHaveSameElements([1, 2, 2], [2, 1, 2])).toBe(true);
      expect(arraysHaveSameElements([1, 2], [1, 2, 2])).toBe(false);
      expect(arraysHaveSameElements(undefined, undefined)).toBe(true);
    });

    it('getDefaultEntityProps: returns default flags and timestamps', () => {
      vi.spyOn(Date, 'now').mockReturnValue(123);

      expect(getDefaultEntityProps()).toEqual({
        isShared: false,
        publishedWithMe: false,
        sharedWithMe: false,
        updatedAt: 123,
        createdAt: 123,
      });

      vi.restoreAllMocks();
    });

    it('getDefaultConversationProps: includes default entity props + reference from nanoid', () => {
      vi.spyOn(Date, 'now').mockReturnValue(123);
      vi.mock('nanoid', () => ({
        nanoid: () => 'nanoid-fixed',
      }));

      expect(getDefaultConversationProps()).toEqual({
        isShared: false,
        publishedWithMe: false,
        sharedWithMe: false,
        updatedAt: 123,
        createdAt: 123,
        reference: 'nanoid-fixed',
      });

      vi.restoreAllMocks();
    });

    it('getSafeRedirectUrl: returns URL only for same-origin urls (absolute or relative)', () => {
      const origin = window.location.origin;

      const relative = getSafeRedirectUrl('/path');
      expect(relative?.origin).toBe(origin);

      const sameOriginAbs = getSafeRedirectUrl(`${origin}/x`);
      expect(sameOriginAbs?.origin).toBe(origin);

      const external = getSafeRedirectUrl('https://example.com/x');
      expect(external).toBeUndefined();
    });

    it('getSafeRedirectUrl: returns undefined for invalid url and logs error', () => {
      const err = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const res = getSafeRedirectUrl('http://%');
      expect(res).toBeUndefined();
      expect(err).toHaveBeenCalled();

      err.mockRestore();
    });
  });
});
