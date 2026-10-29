import type { Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import type { DialClientService } from '../dial/dial-client.service';

/* Only a missing file means "nothing stored yet"; any other failed read must not be written back as empty. */
const MISSING_FILE_STATUS = 404;

/* Enough to diagnose a failed write; upstream error bodies are implementation-defined, so they are not logged whole. */
const MAX_LOGGED_ERROR_BODY_LENGTH = 200;

export enum ClientDataReadKind {
  Missing = 'missing',
  Malformed = 'malformed',
  Ok = 'ok',
}

export type ClientDataReadResult =
  | { kind: ClientDataReadKind.Missing }
  | { kind: ClientDataReadKind.Malformed }
  | { kind: ClientDataReadKind.Ok; value: unknown };

/**
 * Reads and writes one small JSON file under `.client_data/` in the user's DIAL Core bucket.
 * @param dialClient - shared DIAL Core client
 * @param logger - owning service's logger, so log lines keep their origin
 * @param label - human-readable file description used in log messages
 * @param contextPrefix - prefix of the error context handed to `handleDialSdkError`
 */
export class ClientDataJsonFile {
  constructor(
    private readonly dialClient: DialClientService,
    private readonly logger: Logger,
    private readonly label: string,
    private readonly contextPrefix: string,
  ) {}

  /** @throws HttpException when DIAL Core fails the read (anything but a 404). */
  async read(
    path: string,
    token: string,
    bucket: string,
  ): Promise<ClientDataReadResult> {
    const context = `${this.contextPrefix}.readConfig`;
    let response: Response;
    try {
      ({ response } = (await this.dialClient.client.downloadFile(bucket, path, {
        headers: getBearerAuthHeaders(token),
        parseAs: 'stream',
      })) as { response: Response });
    } catch (err) {
      return handleDialSdkError(err, context, this.logger);
    }

    if (response.status === MISSING_FILE_STATUS) {
      return { kind: ClientDataReadKind.Missing };
    }
    if (!response.ok) {
      return handleDialSdkError({}, context, this.logger, response);
    }

    try {
      const text = await response.text();
      return { kind: ClientDataReadKind.Ok, value: JSON.parse(text) };
    } catch {
      this.logger.warn(`Malformed ${this.label} file, using default`);
      return { kind: ClientDataReadKind.Malformed };
    }
  }

  /** @throws HttpException when DIAL Core rejects the upload. */
  async write(
    path: string,
    data: unknown,
    token: string,
    bucket: string,
  ): Promise<void> {
    try {
      const { error, response } = (await this.dialClient.client.uploadFile(
        bucket,
        path,
        {
          headers: getBearerAuthHeaders(token),
          /*
           * FormData ensures fetch emits Content-Type: multipart/form-data;boundary=…
           * A plain Buffer causes openapi-fetch to send a boundary-less header, which DIAL Core rejects.
           */
          body: (() => {
            const fd = new FormData();
            fd.append('file', new Blob([JSON.stringify(data)]), path);
            return fd;
          })() as unknown as string,
        },
      )) as { error?: unknown; response: Response };

      if (error != null) {
        const body = await response.text().catch(() => '(unreadable)');
        this.logger.error(
          `Failed to write ${this.label} — DIAL Core ${response.status}: ${body.slice(0, MAX_LOGGED_ERROR_BODY_LENGTH)}`,
          error,
        );
        return handleDialSdkError(
          error,
          `${this.contextPrefix}.writeConfig`,
          this.logger,
          response,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to write ${this.label}`, err);
      throw err;
    }
  }
}
