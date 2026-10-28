import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isValidDialEntityName } from '../../common/validators/dial-entity-name.validator';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
  PROJECT_CONTEXT_MAX_FILES,
} from '../constants/project-context.constants';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';
import {
  projectBadRequest,
  projectPayloadTooLarge,
} from '../utils/project-create-error.util';
import {
  buildProjectManifest,
  PROJECT_CONTEXT_FOLDER,
  PROJECT_MANIFEST_FILE,
} from '../utils/project-manifest.util';

export interface UploadedContextFile {
  buffer: Buffer;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  instructions?: string;
  fileNames?: string;
}

export interface ProjectCreatePackage {
  formData: FormData;
  fileCount: number;
  totalBytes: number;
}

const CSV_SNIFF_BYTES = 8192;

/* Content signatures for the built-in types. Any other operator-configured
 * extension is checked by extension only. CSV has no magic number, so its
 * check only rejects binary content (a NUL byte in the first 8 KiB); any
 * text-like buffer passes. */
const SIGNATURE_CHECKS: Record<string, (buffer: Buffer) => boolean> = {
  pdf: (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-',
  xlsx: (buffer) =>
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04,
  csv: (buffer) => !buffer.subarray(0, CSV_SNIFF_BYTES).includes(0),
};

const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const getExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
};

/**
 * Validates a `POST /api/v1/projects` request against the actually received
 * parts and builds the outbound Core `FormData`: `PROJECT.md` plus one
 * `context/{name}` part per file. Every rejection carries a
 * `ProjectCreateErrorCode`. Owned by `ProjectsService.createProject`, which
 * keeps the Core call and its error mapping — the same split as
 * `SkillsPackageService` / `SkillsUploadService`.
 */
@Injectable()
export class ProjectsCreateService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  validateAndBuild(
    input: ProjectCreateInput,
    files: UploadedContextFile[],
  ): ProjectCreatePackage {
    this.validateName(input.name);
    const fileNames = this.validateIncomingFiles(input.fileNames, files);
    const totalBytes = this.sumSizes(files);
    this.assertWithinCapacity(totalBytes);

    const manifest = buildProjectManifest({
      name: input.name,
      description: input.description ?? '',
      instructions: input.instructions ?? '',
    });

    return {
      formData: this.buildFormData(manifest, fileNames, files),
      fileCount: files.length,
      totalBytes,
    };
  }

  /** Rejects a project name that is not a valid DIAL resource name (`400 invalid-name`). */
  validateName(name: string): void {
    if (!isValidDialEntityName(name)) {
      throw projectBadRequest(
        ProjectCreateErrorCode.InvalidName,
        'Project name is not a valid DIAL resource name',
        'name',
      );
    }
  }

  /**
   * Pairs the JSON `fileNames` with the received parts and checks every
   * incoming file's name, type, signature and per-file size — the checks
   * create and update share. Returns the authoritative names.
   */
  validateIncomingFiles(
    rawFileNames: string | undefined,
    files: UploadedContextFile[],
  ): string[] {
    const fileNames = this.parseFileNames(rawFileNames, files.length);
    this.validateFileNames(fileNames);
    this.validateFileTypes(fileNames, files);
    this.validateFileSizes(fileNames, files);
    return fileNames;
  }

  /** Rejects a context set whose total exceeds the capacity (`413 capacity-exceeded`). */
  assertWithinCapacity(totalBytes: number): void {
    const maxTotalBytes =
      this.configService.get<number>('PROJECT_CONTEXT_TOTAL_MAX_BYTES') ??
      DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES;
    if (totalBytes > maxTotalBytes) {
      throw projectPayloadTooLarge(
        ProjectCreateErrorCode.CapacityExceeded,
        `Context files total ${totalBytes} bytes, over the limit of ${maxTotalBytes}`,
      );
    }
  }

  /** Rejects a context set with more than `PROJECT_CONTEXT_MAX_FILES` files (`400 too-many-files`). */
  assertWithinFileCount(count: number): void {
    if (count > PROJECT_CONTEXT_MAX_FILES) {
      throw projectBadRequest(
        ProjectCreateErrorCode.TooManyFiles,
        `A project may have at most ${PROJECT_CONTEXT_MAX_FILES} context files`,
      );
    }
  }

  /** Appends one context file part under `context/`, typed by its extension rather than the client's part type. */
  appendContextFile(
    formData: FormData,
    fileName: string,
    buffer: Buffer,
  ): void {
    formData.append(
      'file',
      new Blob([buffer], {
        /* The part's own Content-Type is client-controlled, so an
         * operator-added extension is stored as opaque bytes. */
        type:
          CONTENT_TYPES[getExtension(fileName)] ?? 'application/octet-stream',
      }),
      `${PROJECT_CONTEXT_FOLDER}/${fileName}`,
    );
  }

  private sumSizes(files: UploadedContextFile[]): number {
    return files.reduce((total, file) => total + file.buffer.length, 0);
  }

  private parseFileNames(raw: string | undefined, partCount: number): string[] {
    let parsed: unknown = [];
    if (raw != null && raw !== '') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw this.invalidFileNames('fileNames must be valid JSON');
      }
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === 'string')
    ) {
      throw this.invalidFileNames('fileNames must be a JSON array of strings');
    }
    if (parsed.length !== partCount) {
      throw this.invalidFileNames(
        `fileNames has ${parsed.length} entries but ${partCount} files were received`,
      );
    }
    return parsed;
  }

  private validateFileNames(fileNames: string[]): void {
    this.assertWithinFileCount(fileNames.length);
    const seen = new Set<string>();
    for (const fileName of fileNames) {
      if (!isValidDialEntityName(fileName)) {
        throw projectBadRequest(
          ProjectCreateErrorCode.InvalidFileName,
          `Invalid context file name: ${fileName}`,
          fileName,
        );
      }
      if (seen.has(fileName)) {
        throw projectBadRequest(
          ProjectCreateErrorCode.DuplicateFileName,
          `Duplicate context file name: ${fileName}`,
          fileName,
        );
      }
      seen.add(fileName);
    }
  }

  private validateFileTypes(
    fileNames: string[],
    files: UploadedContextFile[],
  ): void {
    const allowed = new Set(this.getAllowedExtensions());
    fileNames.forEach((fileName, index) => {
      const extension = getExtension(fileName);
      const matchesSignature = SIGNATURE_CHECKS[extension] ?? (() => true);
      if (!allowed.has(extension) || !matchesSignature(files[index].buffer)) {
        throw projectBadRequest(
          ProjectCreateErrorCode.UnsupportedFileType,
          `Unsupported context file type: ${fileName}`,
          fileName,
        );
      }
    });
  }

  private validateFileSizes(
    fileNames: string[],
    files: UploadedContextFile[],
  ): void {
    const maxFileBytes =
      this.configService.get<number>('PROJECT_CONTEXT_FILE_MAX_BYTES') ??
      DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES;

    files.forEach((file, index) => {
      if (file.buffer.length > maxFileBytes) {
        throw projectPayloadTooLarge(
          ProjectCreateErrorCode.FileTooLarge,
          `Context file '${fileNames[index]}' exceeds the per-file limit of ${maxFileBytes} bytes`,
          fileNames[index],
        );
      }
    });
  }

  private getAllowedExtensions(): string[] {
    return (
      this.configService.get<string[]>('PROJECT_CONTEXT_ALLOWED_EXTENSIONS') ??
      DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS
    );
  }

  private buildFormData(
    manifest: string,
    fileNames: string[],
    files: UploadedContextFile[],
  ): FormData {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([manifest], { type: 'text/markdown' }),
      PROJECT_MANIFEST_FILE,
    );
    fileNames.forEach((fileName, index) => {
      this.appendContextFile(formData, fileName, files[index].buffer);
    });
    return formData;
  }

  private invalidFileNames(message: string) {
    return projectBadRequest(ProjectCreateErrorCode.InvalidFileName, message);
  }
}
