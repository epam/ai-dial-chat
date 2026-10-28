import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import { UserConfigService } from '../../user-config/user-config.service';
import { PROJECT_MANIFEST_MAX_BYTES } from '../constants/project-context.constants';
import {
  type ProjectCreateInput,
  ProjectsCreateService,
  type UploadedContextFile,
} from '../create/projects-create.service';
import type { UpdateProjectResponseDto } from '../dto/update-project.dto';
import {
  type ProjectSnapshot,
  ProjectsSnapshotService,
} from '../snapshot/projects-snapshot.service';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';
import {
  projectBadRequest,
  projectChanged,
  projectConflict,
  projectPayloadTooLarge,
  requireSingleIfMatch,
} from '../utils/project-create-error.util';
import {
  buildSiblingProjectId,
  type ParsedProjectId,
  PROJECTS_ID_PREFIX,
} from '../utils/project-id.util';
import {
  buildProjectManifest,
  PROJECT_CONTEXT_FOLDER,
  PROJECT_MANIFEST_FILE,
} from '../utils/project-manifest.util';

/** Text fields of a project update; `fileNames` names the added files only. */
export interface ProjectUpdateInput extends ProjectCreateInput {
  removedFileNames?: string;
}

const UPDATE_CONTEXT = 'projects.updateProject';
/* As for create: a save can carry 10 MiB of context. */
const PROJECT_UPDATE_TIMEOUT_MS = 60_000;
/*
 * Deadline of the rename steps that follow a committed write (move, ETag
 * read-back). They run under this timeout alone, not the client-disconnect
 * signal: once the content is saved, a closed tab must not stop the rename
 * half-way.
 */
const PROJECT_RENAME_TIMEOUT_MS = 30_000;

const toResourceUrl = (project: ParsedProjectId): string =>
  `${PROJECTS_ID_PREFIX}/${project.bucket}/${encodeDialResourcePath(project.path)}`;

const nameTaken = (): HttpException =>
  projectConflict(
    ProjectCreateErrorCode.NameTaken,
    'A project with this name already exists',
    'name',
  );

const manifestTooLarge = (): HttpException =>
  projectPayloadTooLarge(
    ProjectCreateErrorCode.ProjectTooLarge,
    `The project's ${PROJECT_MANIFEST_FILE} exceeds the ${PROJECT_MANIFEST_MAX_BYTES}-byte limit and cannot be edited here`,
  );

const describeError = (err: unknown): string =>
  err instanceof Error ? err.name : 'unknown error';

/**
 * Saves a project edit in one DIAL Core write. The caller's `If-Match` must
 * name the snapshot the BFF reads; the BFF then rebuilds `PROJECT.md`, keeps
 * every untouched file from that snapshot, adds the uploaded ones and makes
 * a single conditional `uploadProjectFolder` — so an edit commits whole or
 * not at all. A rename is a Core move that follows the write, because Core's
 * move takes no ETag (`openspec/changes/add-project-view-page/design.md` D5).
 * Only the owner edits: a project outside the caller's bucket is refused
 * before any Core call, matching `canEdit`. Logs carry counts and byte
 * totals, never names or content.
 */
@Injectable()
export class ProjectsUpdateService {
  private readonly logger = new Logger(ProjectsUpdateService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly createService: ProjectsCreateService,
    private readonly snapshotService: ProjectsSnapshotService,
    private readonly userConfigService: UserConfigService,
  ) {}

  async updateProject(
    project: ParsedProjectId,
    input: ProjectUpdateInput,
    files: UploadedContextFile[],
    ifMatch: string | undefined,
    sessionBucket: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<UpdateProjectResponseDto> {
    if (project.bucket !== sessionBucket) {
      throw new ForbiddenException('Only the owner can edit a project');
    }
    const expectedEtag = requireSingleIfMatch(ifMatch);

    this.createService.validateName(input.name);
    const fileNames = this.createService.validateIncomingFiles(
      input.fileNames,
      files,
    );
    const removedFileNames = this.parseRemovedFileNames(input.removedFileNames);

    const timeoutSignal = AbortSignal.timeout(PROJECT_UPDATE_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const snapshot = await this.snapshotService.read(
      project.bucket,
      project.path,
      accessToken,
      sessionBucket,
      requestSignal,
    );
    if (snapshot.etag !== expectedEtag) throw projectChanged();
    /* Rebuilding a manifest the BFF never read would overwrite it. */
    if (snapshot.hasOversizedManifest) throw manifestTooLarge();

    const keptFiles = this.resolveKeptFiles(
      snapshot,
      removedFileNames,
      fileNames,
    );
    const totalBytes =
      keptFiles.reduce((total, file) => total + file.size, 0) +
      files.reduce((total, file) => total + file.buffer.length, 0);
    this.createService.assertWithinFileCount(keptFiles.length + files.length);
    this.createService.assertWithinCapacity(totalBytes);

    const destination =
      input.name === project.name
        ? null
        : buildSiblingProjectId(project, input.name);
    if (destination != null) {
      await this.assertNameFree(destination, accessToken, requestSignal);
    }

    const formData = await this.buildFormData(
      snapshot,
      input,
      keptFiles.map((file) => file.name),
      fileNames,
      files,
    );
    const writtenEtag = await this.write(
      project,
      formData,
      snapshot.etag,
      accessToken,
      requestSignal,
    );
    this.logger.log(
      `Project saved (kept=${keptFiles.length}, added=${files.length}, removed=${removedFileNames.length}, bytes=${totalBytes})`,
    );

    if (destination == null) {
      return this.toResponse(project, writtenEtag, accessToken, sessionBucket);
    }

    const renameSignal = AbortSignal.timeout(PROJECT_RENAME_TIMEOUT_MS);
    await this.move(project, destination, accessToken, renameSignal);
    await this.migratePinQuietly(
      project.id,
      destination.id,
      accessToken,
      sessionBucket,
    );
    const movedEtag = await this.readEtagQuietly(
      destination,
      accessToken,
      renameSignal,
    );
    return this.toResponse(destination, movedEtag, accessToken, sessionBucket);
  }

  private parseRemovedFileNames(raw: string | undefined): string[] {
    if (raw == null || raw === '') return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw projectBadRequest(
        ProjectCreateErrorCode.InvalidFileName,
        'removedFileNames must be valid JSON',
      );
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === 'string')
    ) {
      throw projectBadRequest(
        ProjectCreateErrorCode.InvalidFileName,
        'removedFileNames must be a JSON array of strings',
      );
    }
    return parsed;
  }

  /** The stored context files that survive the save; a removal must name a stored file, an addition must not collide with a kept one. */
  private resolveKeptFiles(
    snapshot: ProjectSnapshot,
    removedFileNames: string[],
    addedFileNames: string[],
  ) {
    const stored = new Set(snapshot.contextFiles.map((file) => file.name));
    const removed = new Set(removedFileNames);
    for (const name of removed) {
      if (!stored.has(name)) {
        throw projectBadRequest(
          ProjectCreateErrorCode.UnknownFile,
          `No context file named ${name}`,
          name,
        );
      }
    }

    const kept = snapshot.contextFiles.filter(
      (file) => !removed.has(file.name),
    );
    const keptNames = new Set(kept.map((file) => file.name));
    for (const name of addedFileNames) {
      if (keptNames.has(name)) {
        throw projectBadRequest(
          ProjectCreateErrorCode.DuplicateFileName,
          `Duplicate context file name: ${name}`,
          name,
        );
      }
    }
    return kept;
  }

  /** `409 name-taken` when any resource or grouping folder already has the destination path. */
  private async assertNameFree(
    destination: ParsedProjectId,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<void> {
    if (await this.exists(destination, accessToken, signal)) throw nameTaken();
  }

  private async exists(
    target: ParsedProjectId,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      const { error, response } =
        await this.dialClient.client.listProjectMetadata(
          target.bucket,
          encodeDialResourcePath(target.path),
          { headers: getBearerAuthHeaders(accessToken), signal },
        );
      if (error == null && response.status < 400) return true;
      if (response.status === 404) return false;
      return handleDialSdkError(error, UPDATE_CONTEXT, this.logger, response);
    } catch (err) {
      return handleDialSdkError(err, UPDATE_CONTEXT, this.logger);
    }
  }

  private async buildFormData(
    snapshot: ProjectSnapshot,
    input: ProjectUpdateInput,
    keptFileNames: string[],
    addedFileNames: string[],
    files: UploadedContextFile[],
  ): Promise<FormData> {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(
        [
          buildProjectManifest({
            name: input.name,
            description: input.description ?? '',
            instructions: input.instructions ?? '',
            extraFrontmatter: snapshot.manifest?.extraFrontmatter,
          }),
        ],
        { type: 'text/markdown' },
      ),
      PROJECT_MANIFEST_FILE,
    );
    /*
     * Kept context files keep their bytes; their content type is re-derived
     * from the extension, because Core's archive does not carry the stored
     * one (a known limitation, see `apps/chat-api/README.md`).
     */
    for (const name of keptFileNames) {
      this.createService.appendContextFile(
        formData,
        name,
        await snapshot.readEntry(`${PROJECT_CONTEXT_FOLDER}/${name}`),
      );
    }
    addedFileNames.forEach((name, index) => {
      this.createService.appendContextFile(formData, name, files[index].buffer);
    });
    /*
     * Files another client wrote outside the chat's layout keep their bytes
     * and path, but not their content type: the archive carries none, so
     * they are re-uploaded as `application/octet-stream`.
     */
    for (const entryPath of snapshot.otherEntries) {
      formData.append(
        'file',
        new Blob([await snapshot.readEntry(entryPath)], {
          type: 'application/octet-stream',
        }),
        entryPath,
      );
    }
    return formData;
  }

  /** One conditional whole-project write; Core's `412` means the project changed since the snapshot. */
  private async write(
    project: ParsedProjectId,
    formData: FormData,
    etag: string,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<string> {
    try {
      const { error, response } =
        await this.dialClient.client.uploadProjectFolder(
          project.bucket,
          encodeDialResourcePath(project.path),
          {
            headers: { ...getBearerAuthHeaders(accessToken), 'If-Match': etag },
            body: formData as unknown as { file: string },
            signal,
          },
        );
      if (error != null || response.status >= 400) {
        if (response.status === 412) throw projectChanged();
        return mapDialHttpStatus(
          response.status,
          UPDATE_CONTEXT,
          this.logger,
          undefined,
          extractDialErrorMessage(error),
        );
      }
      return response.headers.get('etag') ?? etag;
    } catch (err) {
      return handleDialSdkError(err, UPDATE_CONTEXT, this.logger);
    }
  }

  /**
   * Moves the saved project to its new name. It runs after the write has
   * committed, so it never reports a generic failure for a saved edit: Core
   * refuses an existing destination with a `400`, and a destination that
   * appeared since the pre-check is `409 name-taken`; any other failure is
   * `409 project-changed`, so the client reloads and sees the content saved
   * under the old name.
   */
  private async move(
    source: ParsedProjectId,
    destination: ParsedProjectId,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<void> {
    let status: number | undefined;
    let failure = 'unknown error';
    try {
      const { error, response } = await this.dialClient.client.moveResource({
        headers: getBearerAuthHeaders(accessToken),
        body: {
          sourceUrl: toResourceUrl(source),
          destinationUrl: toResourceUrl(destination),
          overwrite: false,
        },
        signal,
      });
      if (error == null && response.status < 400) return;
      status = response.status;
      failure = `status=${response.status}`;
    } catch (err) {
      failure = describeError(err);
    }

    if (
      status === 400 &&
      (await this.existsQuietly(destination, accessToken, signal))
    ) {
      throw nameTaken();
    }
    this.logger.warn(
      `Project rename failed after the save committed (${failure}); the content is saved under the old name`,
    );
    throw projectChanged();
  }

  /** {@link exists} for the post-commit path, where a failed check counts as "not there". */
  private async existsQuietly(
    target: ParsedProjectId,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      return await this.exists(target, accessToken, signal);
    } catch {
      return false;
    }
  }

  /*
   * Core recomputes the marker when it copies a project, so the moved
   * project's ETag is read back rather than assumed. The rename has already
   * committed, so a failed read is logged and the response omits the ETag.
   */
  private async readEtagQuietly(
    project: ParsedProjectId,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    let failure: string;
    try {
      const { data, error, response } =
        await this.dialClient.client.listProjectMetadata(
          project.bucket,
          encodeDialResourcePath(project.path),
          { headers: getBearerAuthHeaders(accessToken), signal },
        );
      const etag = (data as { etag?: string } | undefined)?.etag;
      if (error == null && etag != null) return etag;
      failure = `status=${response.status}`;
    } catch (err) {
      failure = describeError(err);
    }
    this.logger.warn(
      `Reading the renamed project's ETag failed (${failure}); answering without it`,
    );
    return undefined;
  }

  /** Best-effort pin migration after a committed rename; a failure is logged, not thrown. */
  private async migratePinQuietly(
    oldId: string,
    newId: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    try {
      await this.userConfigService.replaceProjectPin(
        oldId,
        newId,
        accessToken,
        sessionBucket,
      );
    } catch (err) {
      this.logger.warn(
        `Pin migration after a project rename failed (${describeError(err)})`,
      );
    }
  }

  private async toResponse(
    project: ParsedProjectId,
    etag: string | undefined,
    accessToken: string,
    sessionBucket: string,
  ): Promise<UpdateProjectResponseDto> {
    let isPinned = false;
    try {
      isPinned = (
        await this.userConfigService.getPinnedProjectIds(
          accessToken,
          sessionBucket,
        )
      ).includes(project.id);
    } catch {
      this.logger.warn('Reading pins after a project save failed');
    }
    return {
      id: project.id,
      name: project.name,
      bucket: project.bucket,
      path: project.path,
      ...(etag != null ? { etag } : {}),
      isPinned,
    };
  }
}
