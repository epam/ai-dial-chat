import type { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  ProjectsCreateService,
  type UploadedContextFile,
} from '../create/projects-create.service';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';

const PDF = Buffer.from('%PDF-1.7 body');
const XLSX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]);
const CSV = Buffer.from('a,b\n1,2\n');

const file = (buffer: Buffer) => ({ buffer }) satisfies UploadedContextFile;

const makeService = (config: Record<string, unknown> = {}) =>
  new ProjectsCreateService({
    get: (key: string) => config[key],
  } as unknown as ConfigService<EnvironmentVariables>);

const captureError = (fn: () => unknown): HttpException => {
  try {
    fn();
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('Expected an error');
};

const expectRejection = (
  fn: () => unknown,
  status: number,
  code: ProjectCreateErrorCode,
  field?: string,
) => {
  const error = captureError(fn);
  expect(error.getStatus()).toBe(status);
  expect(error.getResponse()).toMatchObject({
    statusCode: status,
    code,
    ...(field != null ? { field } : {}),
  });
};

const readParts = async (formData: FormData) =>
  Promise.all(
    formData.getAll('file').map(async (entry) => {
      const blob = entry as File;
      return {
        name: blob.name,
        type: blob.type,
        text: await blob.text(),
      };
    }),
  );

describe('ProjectsCreateService', () => {
  describe('valid requests', () => {
    it('builds a single PROJECT.md part for a name-only project', async () => {
      const result = makeService().validateAndBuild({ name: 'Handbook' }, []);
      const parts = await readParts(result.formData);

      expect(result).toMatchObject({ fileCount: 0, totalBytes: 0 });
      expect(parts).toHaveLength(1);
      expect(parts[0].name).toBe('PROJECT.md');
      expect(parts[0].text).toBe(
        '---\nname: Handbook\ndescription: ""\n---\n\n',
      );
    });

    it('stores every field and file under context/ with its exact bytes', async () => {
      const result = makeService().validateAndBuild(
        {
          name: 'Q4 launch',
          description: 'About Q4',
          instructions: '## Steps',
          fileNames: '["tickets.csv","report.pdf","survey.xlsx"]',
        },
        [file(CSV), file(PDF), file(XLSX)],
      );
      const parts = await readParts(result.formData);

      expect(parts.map((part) => part.name)).toEqual([
        'PROJECT.md',
        'context/tickets.csv',
        'context/report.pdf',
        'context/survey.xlsx',
      ]);
      expect(parts.map((part) => part.type)).toEqual([
        'text/markdown',
        'text/csv',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]);
      expect(parts[1].text).toBe(CSV.toString());
      const [, frontmatter, body] = parts[0].text.split(/^---\n|\n---\n\n/m);
      expect(parseYaml(frontmatter)).toEqual({
        name: 'Q4 launch',
        description: 'About Q4',
      });
      expect(body).toBe('## Steps');
      expect(result).toMatchObject({
        fileCount: 3,
        totalBytes: CSV.length + PDF.length + XLSX.length,
      });
    });

    it('accepts files exactly at the per-file and total limits', () => {
      const service = makeService({
        PROJECT_CONTEXT_FILE_MAX_BYTES: 4,
        PROJECT_CONTEXT_TOTAL_MAX_BYTES: 8,
      });

      expect(() =>
        service.validateAndBuild(
          { name: 'p', fileNames: '["a.csv","b.csv"]' },
          [file(Buffer.from('abcd')), file(Buffer.from('efgh'))],
        ),
      ).not.toThrow();
    });

    it('accepts an operator-configured extension by extension only', () => {
      const service = makeService({
        PROJECT_CONTEXT_ALLOWED_EXTENSIONS: ['md'],
      });

      expect(() =>
        service.validateAndBuild({ name: 'p', fileNames: '["notes.md"]' }, [
          file(Buffer.from('\u0000binary')),
        ]),
      ).not.toThrow();
    });

    it('ignores the client-supplied MIME type of an operator-configured extension', async () => {
      const multerPart = {
        buffer: Buffer.from('<p>hi</p>'),
        mimetype: 'text/html',
      };
      const result = makeService({
        PROJECT_CONTEXT_ALLOWED_EXTENSIONS: ['md'],
      }).validateAndBuild({ name: 'p', fileNames: '["notes.md"]' }, [
        multerPart,
      ]);
      const parts = await readParts(result.formData);

      expect(parts[1].type).toBe('application/octet-stream');
    });
  });

  describe('name', () => {
    it.each(['../other', 'a/b', 'files', ' padded', 'a‮b'])(
      'rejects the project name %j as invalid-name',
      (name) => {
        expectRejection(
          () => makeService().validateAndBuild({ name }, []),
          400,
          ProjectCreateErrorCode.InvalidName,
          'name',
        );
      },
    );
  });

  describe('file names', () => {
    it.each([
      ['not JSON', 'nope'],
      ['not an array of strings', '[1]'],
      ['fewer names than parts', '[]'],
    ])('rejects fileNames that are %s', (_label, fileNames) => {
      expectRejection(
        () =>
          makeService().validateAndBuild({ name: 'p', fileNames }, [file(CSV)]),
        400,
        ProjectCreateErrorCode.InvalidFileName,
      );
    });

    it.each(['../PROJECT.md', 'sub/file.csv', '.dial-resource'])(
      'rejects the traversal or reserved file name %s',
      (fileName) => {
        expectRejection(
          () =>
            makeService().validateAndBuild(
              { name: 'p', fileNames: JSON.stringify([fileName]) },
              [file(CSV)],
            ),
          400,
          ProjectCreateErrorCode.InvalidFileName,
          fileName,
        );
      },
    );

    it('rejects a duplicate file name', () => {
      expectRejection(
        () =>
          makeService().validateAndBuild(
            { name: 'p', fileNames: '["a.csv","a.csv"]' },
            [file(CSV), file(CSV)],
          ),
        400,
        ProjectCreateErrorCode.DuplicateFileName,
        'a.csv',
      );
    });

    it('rejects more than the maximum number of context files', () => {
      const names = Array.from({ length: 101 }, (_, i) => `f${i}.csv`);
      expectRejection(
        () =>
          makeService().validateAndBuild(
            { name: 'p', fileNames: JSON.stringify(names) },
            names.map(() => file(CSV)),
          ),
        400,
        ProjectCreateErrorCode.TooManyFiles,
      );
    });

    it('rejects an oversized batch before checking any file name', () => {
      const names = Array.from({ length: 101 }, () => '../a.csv');
      expectRejection(
        () =>
          makeService().validateAndBuild(
            { name: 'p', fileNames: JSON.stringify(names) },
            names.map(() => file(CSV)),
          ),
        400,
        ProjectCreateErrorCode.TooManyFiles,
      );
    });
  });

  describe('file types', () => {
    it('rejects an extension that is not allowed', () => {
      expectRejection(
        () =>
          makeService().validateAndBuild(
            { name: 'p', fileNames: '["notes.docx"]' },
            [file(Buffer.from('PK\u0003\u0004'))],
          ),
        400,
        ProjectCreateErrorCode.UnsupportedFileType,
        'notes.docx',
      );
    });

    it.each([
      ['report.pdf', Buffer.from('not a pdf')],
      ['survey.xlsx', Buffer.from('plain text')],
      ['data.csv', Buffer.from([0x61, 0x00, 0x62])],
    ])('rejects %s whose content does not match its type', (name, buffer) => {
      expectRejection(
        () =>
          makeService().validateAndBuild(
            { name: 'p', fileNames: JSON.stringify([name]) },
            [file(buffer)],
          ),
        400,
        ProjectCreateErrorCode.UnsupportedFileType,
        name,
      );
    });
  });

  describe('sizes', () => {
    it('rejects a file one byte over the per-file limit', () => {
      expectRejection(
        () =>
          makeService({ PROJECT_CONTEXT_FILE_MAX_BYTES: 4 }).validateAndBuild(
            { name: 'p', fileNames: '["a.csv"]' },
            [file(Buffer.from('abcde'))],
          ),
        413,
        ProjectCreateErrorCode.FileTooLarge,
        'a.csv',
      );
    });

    it('rejects files whose sum is over the total limit', () => {
      expectRejection(
        () =>
          makeService({
            PROJECT_CONTEXT_FILE_MAX_BYTES: 4,
            PROJECT_CONTEXT_TOTAL_MAX_BYTES: 7,
          }).validateAndBuild({ name: 'p', fileNames: '["a.csv","b.csv"]' }, [
            file(Buffer.from('abcd')),
            file(Buffer.from('efgh')),
          ]),
        413,
        ProjectCreateErrorCode.CapacityExceeded,
      );
    });
  });
});
