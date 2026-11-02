import { createHash } from 'crypto';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as yauzl from 'yauzl';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import {
  PROJECT_ARCHIVE_READ_CONCURRENCY,
  PROJECT_ARCHIVE_READ_MAX_BYTES,
  PROJECT_MANIFEST_MAX_BYTES,
} from '../constants/project-context.constants';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';
import { PROJECT_CONVERSATIONS_FOLDER } from '../utils/project-conversation-id.util';
import { projectPayloadTooLarge } from '../utils/project-create-error.util';
import {
  type ParsedProjectManifest,
  parseProjectManifest,
  PROJECT_CONTEXT_FOLDER,
  PROJECT_MANIFEST_FILE,
} from '../utils/project-manifest.util';

/** One context file of a snapshot: its name under `context/` and its size. */
export interface ProjectSnapshotFile {
  name: string;
  size: number;
}

/**
 * One version of a project, read from DIAL Core's archive. `etag` is the
 * aggregate ETag of exactly these files, so a write conditioned on it is
 * conditioned on what the caller saw.
 */
export interface ProjectSnapshot {
  etag: string;
  /**
   * SHA-256 over the path, CRC-32 and size of every entry except
   * `conversationEntries`, quoted like an entity tag. A conversation write
   * changes `etag` but never this; an edit of `PROJECT.md`, `context/` or any
   * other path does. `PUT` and `DELETE` take it in `If-Match`.
   */
  contentVersion: string;
  /** Parsed `PROJECT.md`, or `null` when the project has none (or it is too large). */
  manifest: ParsedProjectManifest | null;
  /** `PROJECT.md` exists but exceeds `PROJECT_MANIFEST_MAX_BYTES`, so it was not read. */
  hasOversizedManifest: boolean;
  /** Direct children of `context/`, sorted by name. */
  contextFiles: ProjectSnapshotFile[];
  /** Direct children of `conversations/` (project conversations), sorted by name; never inflated by a read. */
  conversationEntries: ProjectSnapshotFile[];
  /** Every other file path (nested `context/` and `conversations/` paths included); a save keeps its bytes and path. */
  otherEntries: string[];
  /** Inflates one entry by its archive path. */
  readEntry: (path: string) => Promise<Buffer>;
}

const SNAPSHOT_CONTEXT = 'projects.readSnapshot';
const CONTEXT_PREFIX = `${PROJECT_CONTEXT_FOLDER}/`;
const CONVERSATIONS_PREFIX = `${PROJECT_CONVERSATIONS_FOLDER}/`;

/* The name of a direct child of `prefix`, or `null` for any other path. */
const directChildName = (path: string, prefix: string): string | null => {
  if (!path.startsWith(prefix)) return null;
  const name = path.slice(prefix.length);
  return name.includes('/') ? null : name;
};

const byName = (a: ProjectSnapshotFile, b: ProjectSnapshotFile): number => {
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
};

/**
 * `contentVersion` of the entries a project edit can change: one line
 * `{path}\t{crc32}\t{size}` per entry, sorted by path, from the central
 * directory only, so nothing is inflated.
 */
export const computeProjectContentVersion = (
  entries: { path: string; crc32: number; size: number }[],
): string => {
  const lines = entries
    .map(({ path, crc32, size }) => `${path}\t${crc32}\t${size}`)
    .sort();
  return `"${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}"`;
};

const tooLarge = (): HttpException =>
  projectPayloadTooLarge(
    ProjectCreateErrorCode.ProjectTooLarge,
    `The project exceeds the ${PROJECT_ARCHIVE_READ_MAX_BYTES}-byte read limit`,
  );

/* `openapi-fetch` resolves an empty-bodied error with `error: undefined`, so
 * the status decides (as in `SkillsDownloadService`). */
const isFailedResponse = (error: unknown, response: Response): boolean =>
  error != null || response.status >= 400;

/* Core's archive paths are relative; anything absolute, with a backslash or
 * a `.`/`..` segment could address a path outside the project on rebuild. */
const isSafeEntryPath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');

/** How `PROJECT.md` was found, for the debug log. */
const describeManifest = (manifest: ParsedProjectManifest | null): string => {
  if (manifest == null) return 'absent';
  return manifest.isMalformed ? 'malformed' : 'parsed';
};

/** Releases a slot taken from an {@link ArchiveReadLimiter}; calling it twice is a no-op. */
type ReleaseSlot = () => void;

/**
 * A minimal counting semaphore for archive reads. A waiter whose signal
 * aborts leaves the queue without ever taking a slot.
 */
class ArchiveReadLimiter {
  private active = 0;
  private readonly waiters: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  acquire(signal: AbortSignal): Promise<ReleaseSlot> {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve(this.releaser());
    }
    return new Promise<ReleaseSlot>((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener('abort', onAbort);
        resolve(this.releaser());
      };
      const onAbort = () => {
        const index = this.waiters.indexOf(grant);
        if (index !== -1) this.waiters.splice(index, 1);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(grant);
    });
  }

  /* A released slot passes straight to the next waiter, so `active` only
   * drops when nobody is queued. */
  private releaser(): ReleaseSlot {
    let isReleased = false;
    return () => {
      if (isReleased) return;
      isReleased = true;
      const next = this.waiters.shift();
      if (next != null) {
        next();
      } else {
        this.active -= 1;
      }
    };
  }
}

const readBody = async (
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > PROJECT_ARCHIVE_READ_MAX_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
};

const readZipEntry = async (
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Buffer> => {
  const stream = await zipfile.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
    );
  }
  return Buffer.concat(chunks);
};

/**
 * Reads a project as one consistent snapshot. DIAL Core's project metadata
 * carries no file sizes, so the archive — whose `ETag` names exactly the
 * version it contains — is the only read that yields sizes, the manifest and
 * a matching ETag together (`openspec/changes/add-project-view-page/design.md`
 * D2). The archive is buffered under a byte cap and only its central
 * directory and `PROJECT.md` are inflated; other entries are inflated lazily
 * by `readEntry`. At most `PROJECT_ARCHIVE_READ_CONCURRENCY` archives are
 * downloaded and parsed at once per process; a further read waits, and its
 * abort signal still ends the wait. Logs carry counts and sizes, never names
 * or content.
 */
@Injectable()
export class ProjectsSnapshotService {
  private readonly logger = new Logger(ProjectsSnapshotService.name);
  private readonly archiveReads = new ArchiveReadLimiter(
    PROJECT_ARCHIVE_READ_CONCURRENCY,
  );

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * `callerBucket` is the session user's bucket: Core masks a missing
   * resource there as `403`, which is reported as `404`.
   */
  async read(
    bucket: string,
    path: string,
    accessToken: string,
    callerBucket: string,
    signal: AbortSignal,
  ): Promise<ProjectSnapshot> {
    let release: ReleaseSlot;
    try {
      release = await this.archiveReads.acquire(signal);
    } catch (err) {
      return handleDialSdkError(err, SNAPSHOT_CONTEXT, this.logger);
    }
    try {
      const archive = await this.downloadArchive(
        bucket,
        path,
        accessToken,
        callerBucket,
        signal,
      );
      return await this.parseArchive(archive.buffer, archive.etag);
    } finally {
      release();
    }
  }

  private async downloadArchive(
    bucket: string,
    path: string,
    accessToken: string,
    callerBucket: string,
    signal: AbortSignal,
  ): Promise<{ buffer: Buffer; etag: string }> {
    try {
      const { error, response } =
        await this.dialClient.client.downloadProjectFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(accessToken),
            parseAs: 'stream',
            signal,
          },
        );

      if (isFailedResponse(error, response)) {
        if (
          response.status === 404 ||
          (response.status === 403 && bucket === callerBucket)
        ) {
          throw new NotFoundException('Project not found');
        }
        return handleDialSdkError(
          error,
          SNAPSHOT_CONTEXT,
          this.logger,
          response,
        );
      }

      const stream = response.body as ReadableStream<Uint8Array> | null;
      const etag = response.headers.get('etag');
      if (stream == null || etag == null) {
        await stream?.cancel();
        this.logger.error(
          'DIAL Core returned a project archive without a body or ETag',
        );
        throw new BadGatewayException(
          'DIAL Core returned an invalid project archive',
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (declaredLength > PROJECT_ARCHIVE_READ_MAX_BYTES) {
        await stream.cancel();
        throw tooLarge();
      }

      return { buffer: await readBody(stream), etag };
    } catch (err) {
      return handleDialSdkError(err, SNAPSHOT_CONTEXT, this.logger);
    }
  }

  private async parseArchive(
    buffer: Buffer,
    etag: string,
  ): Promise<ProjectSnapshot> {
    let zipfile: yauzl.ZipFile;
    const entries = new Map<string, yauzl.Entry>();
    try {
      /* autoClose: false keeps the archive readable after the central
       * directory walk, so `readEntry` can inflate entries later; a
       * buffer-backed archive holds no file descriptor. */
      zipfile = await yauzl.fromBufferPromise(buffer, {
        lazyEntries: true,
        autoClose: false,
      });
      for await (const entry of zipfile.eachEntry()) {
        if (entry.fileName.endsWith('/')) continue;
        if (!isSafeEntryPath(entry.fileName)) {
          throw new Error('unsafe entry path');
        }
        entries.set(entry.fileName, entry);
      }
    } catch (err) {
      /* `err.name` only: yauzl's messages quote entry file names. */
      this.logger.error(
        `DIAL Core returned an unreadable project archive (${err instanceof Error ? err.name : 'unknown error'})`,
      );
      throw new BadGatewayException(
        'DIAL Core returned an invalid project archive',
      );
    }

    const contextFiles: ProjectSnapshotFile[] = [];
    const conversationEntries: ProjectSnapshotFile[] = [];
    const otherEntries: string[] = [];
    const versionedEntries: { path: string; crc32: number; size: number }[] =
      [];
    for (const [entryPath, entry] of entries) {
      const conversationName = directChildName(entryPath, CONVERSATIONS_PREFIX);
      if (conversationName != null) {
        conversationEntries.push({
          name: conversationName,
          size: entry.uncompressedSize,
        });
        continue;
      }
      versionedEntries.push({
        path: entryPath,
        crc32: entry.crc32,
        size: entry.uncompressedSize,
      });
      if (entryPath === PROJECT_MANIFEST_FILE) continue;
      const contextName = directChildName(entryPath, CONTEXT_PREFIX);
      if (contextName != null) {
        contextFiles.push({ name: contextName, size: entry.uncompressedSize });
      } else {
        otherEntries.push(entryPath);
      }
    }
    contextFiles.sort(byName);
    conversationEntries.sort(byName);

    const readEntry = async (entryPath: string): Promise<Buffer> => {
      const entry = entries.get(entryPath);
      if (entry == null) {
        throw new BadGatewayException(
          'DIAL Core returned an invalid project archive',
        );
      }
      try {
        return await readZipEntry(zipfile, entry);
      } catch {
        throw new BadGatewayException(
          'DIAL Core returned an invalid project archive',
        );
      }
    };

    const manifestEntry = entries.get(PROJECT_MANIFEST_FILE);
    const manifest = await this.readManifest(manifestEntry, readEntry);
    /* Debug only (LOG_LEVEL=debug): what Core's archive held — paths and
     * sizes, never file content. */
    this.logger.debug(
      `DIAL Core project archive: etag=${etag}, bytes=${buffer.length}, ` +
        `manifest=${describeManifest(manifest)}, ` +
        `entries=${JSON.stringify(
          [...entries].map(([path, entry]) => ({
            path,
            size: entry.uncompressedSize,
          })),
        )}`,
    );

    return {
      etag,
      contentVersion: computeProjectContentVersion(versionedEntries),
      manifest,
      hasOversizedManifest:
        manifestEntry != null &&
        manifestEntry.uncompressedSize > PROJECT_MANIFEST_MAX_BYTES,
      contextFiles,
      conversationEntries,
      otherEntries,
      readEntry,
    };
  }

  private async readManifest(
    entry: yauzl.Entry | undefined,
    readEntry: (path: string) => Promise<Buffer>,
  ): Promise<ParsedProjectManifest | null> {
    if (entry == null) return null;
    if (entry.uncompressedSize > PROJECT_MANIFEST_MAX_BYTES) {
      this.logger.warn(
        `Project manifest ignored: ${entry.uncompressedSize} bytes exceeds the ${PROJECT_MANIFEST_MAX_BYTES}-byte limit`,
      );
      return null;
    }

    const manifest = parseProjectManifest(
      (await readEntry(PROJECT_MANIFEST_FILE)).toString('utf8'),
    );
    if (manifest.isMalformed) {
      this.logger.warn(
        'Project manifest has no parseable frontmatter; kept as instructions',
      );
    }
    return manifest;
  }
}
