import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as yauzl from 'yauzl';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { UploadedSkillFile } from '../package/skills-package.service';
import {
  InvalidSkillManifestError,
  parseSkillManifestFrontmatter,
} from '../utils/skill-manifest-frontmatter.util';
import {
  SKILL_MANIFEST_FILE,
  isValidSkillName,
  resolveSkillEntryPath,
} from '../utils/skill-path.util';

export interface ExtractedSkillArchive {
  /** Validated `name` from the manifest frontmatter — used as the destination path. */
  name: string;
  skillManifest: string;
  filePaths: string[];
  files: UploadedSkillFile[];
}

interface CollectedEntry {
  entry: yauzl.Entry;
  rawPath: string;
}

interface NormalizedEntry {
  entry: yauzl.Entry;
  normalizedPath: string;
}

const UNIX_FILE_TYPE_MASK = 0xf000;
const UNIX_SYMLINK_TYPE = 0xa000;
const UNIX_REGULAR_FILE_TYPE = 0x8000;
const UNIX_DIRECTORY_TYPE = 0x4000;
const ENCRYPTED_BIT_FLAG = 0x1;
/** Guards against directory-entry amplification before any extraction (design.md D4), mirroring the Files domain's identical guard. */
const ENTRY_COUNT_CEILING_MULTIPLIER = 10;

/**
 * Extracts and validates a whole-Skill ZIP archive for
 * `POST /api/v1/skills/import` (design.md, `add-skill-archive-import`).
 * Performs every archive-specific check (container validity, entry-count
 * ceiling, wrapper-directory stripping, exactly-one-manifest, duplicate
 * paths, entry safety, encrypted/symlink rejection, incremental
 * decompression limits, manifest UTF-8/frontmatter validation) and returns
 * the same `{ skillManifest, filePaths, files }` shape the existing
 * multipart create endpoint validates — it does not duplicate
 * `SkillsPackageService`'s own path/count/size checks, which still run
 * against the returned bytes.
 */
@Injectable()
export class SkillsArchiveExtractionService {
  private readonly logger = new Logger(SkillsArchiveExtractionService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getUploadMaxFiles(): number {
    return this.configService.get<number>('SKILL_UPLOAD_MAX_FILES') ?? 100;
  }

  private getFileUploadMaxBytes(): number {
    return (
      this.configService.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ?? 1_048_576
    );
  }

  private getUploadMaxTotalBytes(): number {
    return (
      this.configService.get<number>('SKILL_UPLOAD_MAX_TOTAL_BYTES') ??
      16_777_216
    );
  }

  async extract(
    archivePath: string,
    signal?: AbortSignal,
  ): Promise<ExtractedSkillArchive> {
    const zipfile = await this.openArchive(archivePath);

    try {
      const collected = await this.collectEntries(zipfile);
      const { manifestEntry, supportingEntries } =
        this.resolveManifestAndEntries(collected);

      let cumulativeBytes = 0;
      const manifestBuffer = await this.readEntry(
        zipfile,
        manifestEntry.entry,
        cumulativeBytes,
        signal,
      );
      cumulativeBytes += manifestBuffer.length;

      const skillManifest = this.decodeManifest(manifestBuffer);
      const { name } = this.parseManifest(skillManifest);

      if (!isValidSkillName(name)) {
        throw new BadRequestException(
          'Skill manifest "name" must be a safe single path segment',
        );
      }

      const filePaths: string[] = [];
      const files: UploadedSkillFile[] = [];
      for (const { entry, normalizedPath } of supportingEntries) {
        const buffer = await this.readEntry(
          zipfile,
          entry,
          cumulativeBytes,
          signal,
        );
        cumulativeBytes += buffer.length;
        filePaths.push(normalizedPath);
        files.push({ buffer, mimetype: 'application/octet-stream' });
      }

      return { name, skillManifest, filePaths, files };
    } finally {
      zipfile.close();
    }
  }

  private async openArchive(archivePath: string): Promise<yauzl.ZipFile> {
    try {
      /*
       * decodeStrings: false — read raw entry names so resolveSkillEntryPath
       * is the sole zip-slip authority, matching the Files domain's rationale.
       * autoClose: false — keep the descriptor open past eachEntry() so the
       * second pass can openReadStreamPromise() on the collected entries.
       */
      return await yauzl.openPromise(archivePath, {
        lazyEntries: true,
        decodeStrings: false,
        autoClose: false,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to open uploaded skill archive: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid or corrupted ZIP archive');
    }
  }

  private async collectEntries(
    zipfile: yauzl.ZipFile,
  ): Promise<CollectedEntry[]> {
    const maxFiles = this.getUploadMaxFiles();
    if (zipfile.entryCount > maxFiles * ENTRY_COUNT_CEILING_MULTIPLIER) {
      throw new UnprocessableEntityException(
        'Archive contains too many entries',
      );
    }

    const collected: CollectedEntry[] = [];
    for await (const entry of zipfile.eachEntry()) {
      const rawPath = this.decodeEntryName(entry.fileName);
      const { isDirectory, safeRelativePath } = resolveSkillEntryPath(rawPath);
      if (isDirectory) continue;

      if ((entry.generalPurposeBitFlag & ENCRYPTED_BIT_FLAG) !== 0) {
        throw new UnprocessableEntityException(
          'Archive contains an encrypted entry, which is not supported',
        );
      }

      const unixType =
        (entry.externalFileAttributes >>> 16) & UNIX_FILE_TYPE_MASK;
      if (unixType === UNIX_SYMLINK_TYPE) {
        throw new UnprocessableEntityException(
          'Archive contains a symbolic link entry, which is not supported',
        );
      }
      if (
        unixType !== 0 &&
        unixType !== UNIX_REGULAR_FILE_TYPE &&
        unixType !== UNIX_DIRECTORY_TYPE
      ) {
        throw new UnprocessableEntityException(
          'Archive contains an unsupported entry type',
        );
      }

      if (safeRelativePath == null) {
        throw new BadRequestException(
          `Invalid path in archive entry: ${rawPath}`,
        );
      }

      collected.push({ entry, rawPath: safeRelativePath });
    }

    return collected;
  }

  /**
   * Resolves the manifest and normalizes every entry's path (design.md D4).
   * If a root-level `SKILL.md` is present, no wrapper stripping happens. If
   * not, every top-level directory whose immediate child is `SKILL.md` is a
   * wrapper candidate: exactly one candidate is stripped; zero is "missing
   * manifest"; more than one is ambiguous ("multiple Skills"). A wrapper
   * candidate is only honored when *every* entry falls under it — a mixed
   * layout (some files inside the wrapper, some outside) is also ambiguous.
   */
  private resolveManifestAndEntries(collected: CollectedEntry[]): {
    manifestEntry: NormalizedEntry;
    supportingEntries: NormalizedEntry[];
  } {
    if (collected.length === 0) {
      throw new BadRequestException(
        `Archive is missing a root ${SKILL_MANIFEST_FILE} file`,
      );
    }

    const rawPaths = collected.map(({ rawPath }) => rawPath);
    const hasRootManifest = rawPaths.includes(SKILL_MANIFEST_FILE);

    let normalized: NormalizedEntry[];

    if (hasRootManifest) {
      normalized = collected.map(({ entry, rawPath }) => ({
        entry,
        normalizedPath: rawPath,
      }));
    } else {
      const wrapperCandidatePattern = /^([^/]+)\/SKILL\.md$/;
      const wrapperSegments = new Set<string>();
      for (const path of rawPaths) {
        const match = wrapperCandidatePattern.exec(path);
        if (match) wrapperSegments.add(match[1]);
      }

      if (wrapperSegments.size === 0) {
        throw new BadRequestException(
          `Archive is missing a root ${SKILL_MANIFEST_FILE} file`,
        );
      }
      if (wrapperSegments.size > 1) {
        throw new UnprocessableEntityException(
          `Archive contains more than one ${SKILL_MANIFEST_FILE} — expected exactly one Skill per archive`,
        );
      }

      const [wrapperSegment] = wrapperSegments;
      const wrapperPrefix = `${wrapperSegment}/`;
      const allNested = rawPaths.every((path) =>
        path.startsWith(wrapperPrefix),
      );
      if (!allNested) {
        throw new UnprocessableEntityException(
          'Archive layout is ambiguous — some files fall outside the wrapper directory',
        );
      }

      normalized = collected.map(({ entry, rawPath }) => ({
        entry,
        normalizedPath: rawPath.slice(wrapperPrefix.length),
      }));
    }

    const seenPaths = new Set<string>();
    for (const { normalizedPath } of normalized) {
      if (seenPaths.has(normalizedPath)) {
        throw new UnprocessableEntityException(
          `Duplicate path in archive: ${normalizedPath}`,
        );
      }
      seenPaths.add(normalizedPath);
    }

    const manifestEntry = normalized.find(
      ({ normalizedPath }) => normalizedPath === SKILL_MANIFEST_FILE,
    );
    if (manifestEntry == null) {
      throw new BadRequestException(
        `Archive is missing a root ${SKILL_MANIFEST_FILE} file`,
      );
    }

    const supportingEntries = normalized.filter(
      ({ normalizedPath }) => normalizedPath !== SKILL_MANIFEST_FILE,
    );

    return { manifestEntry, supportingEntries };
  }

  /**
   * Streams one entry with incremental per-file and running-total limit
   * enforcement (design.md D6) — the ZIP's declared uncompressed-size
   * metadata is never trusted alone, closing the classic zip-bomb vector.
   */
  private async readEntry(
    zipfile: yauzl.ZipFile,
    entry: yauzl.Entry,
    cumulativeBytes: number,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    if (signal?.aborted) {
      throw new ServiceUnavailableException('Skill archive import aborted');
    }

    const maxFileBytes = this.getFileUploadMaxBytes();
    const maxTotalBytes = this.getUploadMaxTotalBytes();

    const stream = await zipfile.openReadStreamPromise(entry);
    const chunks: Buffer[] = [];
    let readBytes = 0;

    const abortRead = (): void => {
      stream.destroy(new Error('SKILL_ARCHIVE_IMPORT_ABORTED'));
    };
    signal?.addEventListener('abort', abortRead, { once: true });

    try {
      for await (const chunk of stream) {
        const buffer: Buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        readBytes += buffer.length;

        if (readBytes > maxFileBytes) {
          throw new PayloadTooLargeException(
            `A file in the archive exceeds the per-file limit of ${maxFileBytes} bytes`,
          );
        }
        if (cumulativeBytes + readBytes > maxTotalBytes) {
          throw new PayloadTooLargeException(
            `Skill total decompressed size exceeds the limit of ${maxTotalBytes} bytes`,
          );
        }

        chunks.push(buffer);
      }
    } finally {
      signal?.removeEventListener('abort', abortRead);
      stream.destroy();
    }

    if (signal?.aborted) {
      throw new ServiceUnavailableException('Skill archive import aborted');
    }

    return Buffer.concat(chunks);
  }

  private decodeManifest(buffer: Buffer): string {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestException('Skill manifest is not valid UTF-8');
    }
  }

  private parseManifest(
    skillManifest: string,
  ): ReturnType<typeof parseSkillManifestFrontmatter> {
    try {
      return parseSkillManifestFrontmatter(skillManifest);
    } catch (err) {
      if (err instanceof InvalidSkillManifestError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  /** Decodes a yauzl entry name read with `decodeStrings: false` (raw `Buffer`), or passes a string through unchanged. */
  private decodeEntryName(rawFileName: string): string {
    const raw: unknown = rawFileName;
    return Buffer.isBuffer(raw) ? raw.toString('utf8') : rawFileName;
  }
}
