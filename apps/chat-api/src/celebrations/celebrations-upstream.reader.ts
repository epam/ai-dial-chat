import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  CELEBRATION_PATH_SEGMENT_PATTERN,
  CELEBRATIONS_UPSTREAM_DIRECTORY,
} from './constants/celebrations.constants';
import {
  CelebrationMediaType,
  type CelebrationResourceKind,
} from './types/celebration';

const DEFAULT_TIMEOUT_MS = 5000;
const MEDIA_TYPES = new Set<string>(Object.values(CelebrationMediaType));

/** What a published resource declares about itself; checked before the bytes are used. */
export interface CelebrationUpstreamExpectation {
  /** Exact byte length. */
  bytes: number;
  /** Lowercase hex SHA-256 of the exact bytes. */
  sha256: string;
  /** Declared media type, checked against the allowlist. */
  mediaType?: string;
}

/** One upstream read under `<THEMES_CONFIG_URL>/celebrations/`. */
export interface CelebrationUpstreamRequest {
  /** Resource kind, for rejection logs. */
  kind: CelebrationResourceKind;
  /** Resource ID, for rejection logs. */
  id: string;
  /** Server-side path relative to the celebrations directory. Never client input. */
  path: string;
  /** Byte cap; the read stops once it is exceeded. */
  maxBytes: number;
  /** Declared size, hash and media type, when the resource has them. */
  expected?: CelebrationUpstreamExpectation;
}

/**
 * The only reader of celebration resources on the themes host. It keeps every
 * request under the celebrations directory, refuses redirects, bounds time and
 * bytes, and verifies the declared size, hash and media type before anything
 * parses, caches or serves the bytes.
 *
 * Raw `fetch` is used because the themes host is a static non-DIAL upstream.
 */
@Injectable()
export class CelebrationsUpstreamReader {
  private readonly logger = new Logger(CelebrationsUpstreamReader.name);
  private readonly base: URL | undefined;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    const themesUrl = configService.get('THEMES_CONFIG_URL', { infer: true });
    this.base = themesUrl
      ? new URL(
          CELEBRATIONS_UPSTREAM_DIRECTORY,
          themesUrl.endsWith('/') ? themesUrl : `${themesUrl}/`,
        )
      : undefined;
    this.timeoutMs =
      configService.get('THEMES_SERVICE_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_TIMEOUT_MS;
  }

  /**
   * Returns the verified bytes of one resource.
   *
   * @throws {NotFoundException} The path leaves the celebrations directory, or the upstream answers 404
   * @throws {BadGatewayException} Another upstream status, a redirect, an exceeded cap, or a size, hash or media-type mismatch
   * @throws {ServiceUnavailableException} `THEMES_CONFIG_URL` is unset, or the upstream timed out or is unreachable
   */
  async read(request: CelebrationUpstreamRequest): Promise<Buffer> {
    if (!this.base) {
      throw new ServiceUnavailableException('Themes service is not configured');
    }
    const url = this.resolve(this.base, request);
    if (
      request.expected?.mediaType !== undefined &&
      !MEDIA_TYPES.has(request.expected.mediaType)
    ) {
      this.reject(request, `media type ${request.expected.mediaType}`);
      throw new BadGatewayException('Celebration resource is invalid');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      /* `manual` instead of `error`: a refused redirect is then a 3xx status,
       * which is a 502, rather than a TypeError that looks like an outage. */
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        this.reject(request, `upstream status ${response.status}`);
        if (response.status === 404) {
          throw new NotFoundException('Celebration resource not found');
        }
        throw new BadGatewayException('Celebration resource is unavailable');
      }
      const body = await this.readBounded(response, request);
      this.verify(body, request);
      return body;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (controller.signal.aborted) {
        this.reject(request, `timed out after ${this.timeoutMs}ms`);
        throw new ServiceUnavailableException(
          'Theme service request timed out',
        );
      }
      this.reject(request, 'upstream unreachable');
      throw new ServiceUnavailableException(
        'Theme service is currently unavailable',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolve(base: URL, request: CelebrationUpstreamRequest): URL {
    const isRelative = request.path
      .split('/')
      .every((segment) => CELEBRATION_PATH_SEGMENT_PATTERN.test(segment));
    const url = isRelative ? new URL(request.path, base) : undefined;
    if (
      !url ||
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname)
    ) {
      this.reject(request, 'path leaves the celebrations directory');
      throw new NotFoundException('Celebration resource not found');
    }
    return url;
  }

  private async readBounded(
    response: Response,
    request: CelebrationUpstreamRequest,
  ): Promise<Buffer> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (declaredLength > request.maxBytes) {
      await response.body?.cancel();
      return this.rejectOversize(request);
    }
    if (!response.body) return Buffer.alloc(0);

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > request.maxBytes) {
        await reader.cancel();
        return this.rejectOversize(request);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  }

  private verify(body: Buffer, request: CelebrationUpstreamRequest): void {
    const { expected } = request;
    if (!expected) return;
    if (body.length !== expected.bytes) {
      this.reject(
        request,
        `size ${body.length} differs from the declared ${expected.bytes}`,
      );
      throw new BadGatewayException('Celebration resource is invalid');
    }
    const sha256 = createHash('sha256').update(body).digest('hex');
    if (sha256 !== expected.sha256) {
      this.reject(request, 'hash differs from the declared sha256');
      throw new BadGatewayException('Celebration resource is invalid');
    }
  }

  private rejectOversize(request: CelebrationUpstreamRequest): never {
    this.reject(request, `body exceeds ${request.maxBytes} bytes`);
    throw new BadGatewayException('Celebration resource is too large');
  }

  private reject(request: CelebrationUpstreamRequest, reason: string): void {
    this.logger.warn(
      `Rejected celebration ${request.kind} ${request.id}: ${reason}`,
    );
  }
}
