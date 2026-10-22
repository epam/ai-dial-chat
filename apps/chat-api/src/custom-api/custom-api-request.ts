import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import {
  CustomApiBody,
  CustomApiOperation,
} from './custom-api-registry.service';
import {
  CustomApiTransportError,
  assertJsonDepthWithinLimit,
} from './custom-api-response';

/** Ceiling for one query value, measured as UTF-8 bytes. */
export const CUSTOM_API_MAX_QUERY_VALUE_BYTES = 2048;
/** Ceiling for the whole re-encoded query string. */
export const CUSTOM_API_MAX_QUERY_BYTES = 8 * 1024;
/** Ceiling for a write's JSON body once re-serialized, measured as UTF-8 bytes. */
export const CUSTOM_API_MAX_BODY_BYTES = 65_536;

/** What the caller may hand on to Core: the allowlisted query and, for writes, a JSON body. */
export interface CustomApiRequestInput {
  readonly query: URLSearchParams;
  /** The re-serialized JSON body; absent for an operation without `body: "json"`. */
  readonly body?: string;
}

/**
 * True when the request declares a payload (a positive `Content-Length` or
 * any `Transfer-Encoding`, which covers content types no body parser reads)
 * or carries a parsed body beyond Express's default empty `{}`.
 */
export const hasNonEmptyBody = (req: Request): boolean => {
  if (req.headers?.['transfer-encoding'] != null) return true;
  if (Number(req.headers?.['content-length'] ?? 0) > 0) return true;
  const body: unknown = req.body;
  if (body == null) return false;
  if (typeof body === 'object') return Object.keys(body).length > 0;
  return true;
};

/*
 * Express 5's `simple` query parser yields flat keys, with a repeated key as
 * an array. Only names the operation allows pass, each once, as a bounded
 * string; they are re-encoded in configuration order so the forwarded query
 * is built by the BFF, never copied from the request line. Messages name no
 * parameter or value: both are caller-controlled.
 */
const parseQuery = (
  query: unknown,
  allowed: readonly string[],
): URLSearchParams => {
  const entries =
    query != null && typeof query === 'object'
      ? Object.entries(query as Record<string, unknown>)
      : [];
  const values = new Map<string, string>();
  for (const [name, value] of entries) {
    if (!allowed.includes(name)) {
      throw new BadRequestException(
        'This operation does not accept that query parameter',
      );
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Each query parameter may appear at most once',
      );
    }
    if (Buffer.byteLength(value, 'utf8') > CUSTOM_API_MAX_QUERY_VALUE_BYTES) {
      throw new BadRequestException('A query parameter value is too long');
    }
    values.set(name, value);
  }

  const forwarded = new URLSearchParams();
  for (const name of allowed) {
    const value = values.get(name);
    if (value !== undefined) forwarded.append(name, value);
  }
  if (
    Buffer.byteLength(forwarded.toString(), 'utf8') > CUSTOM_API_MAX_QUERY_BYTES
  ) {
    throw new BadRequestException('The query string is too long');
  }
  return forwarded;
};

/*
 * A body reaches Core only for a `body: "json"` operation, and only as JSON
 * the BFF re-serialized itself: an object or array, bounded in bytes and
 * depth. Every other operation keeps refusing any payload.
 */
const parseBody = (
  req: Request,
  operation: CustomApiOperation,
): string | undefined => {
  if (operation.body !== CustomApiBody.Json) {
    if (hasNonEmptyBody(req)) {
      throw new BadRequestException('This operation accepts no request body');
    }
    return undefined;
  }
  const body: unknown = req.body;
  if (!req.is('application/json') || body == null || typeof body !== 'object') {
    throw new BadRequestException(
      'This operation requires a JSON object or array body',
    );
  }
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > CUSTOM_API_MAX_BODY_BYTES) {
    throw new BadRequestException('The request body is too large');
  }
  try {
    assertJsonDepthWithinLimit(serialized);
  } catch (error) {
    if (error instanceof CustomApiTransportError) {
      throw new BadRequestException('The request body is nested too deeply');
    }
    throw error;
  }
  return serialized;
};

/** Validates the caller's query and body against the operation; throws 400 before any dispatch. */
export const parseCustomApiRequest = (
  req: Request,
  operation: CustomApiOperation,
): CustomApiRequestInput => {
  const query = parseQuery(req.query, operation.query);
  const body = parseBody(req, operation);
  return body === undefined ? { query } : { query, body };
};
