import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  handleDialFetchError,
  handleDialSdkError,
  mapDialHttpStatus,
} from './dial-error.mapper';

describe('mapDialHttpStatus', () => {
  it('throws BadRequestException for 400', () => {
    expect(() => mapDialHttpStatus(400, 'ctx')).toThrow(BadRequestException);
  });

  it('throws UnauthorizedException for 401', () => {
    expect(() => mapDialHttpStatus(401, 'ctx')).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException for 403', () => {
    expect(() => mapDialHttpStatus(403, 'ctx')).toThrow(ForbiddenException);
  });

  it('throws NotFoundException for 404', () => {
    expect(() => mapDialHttpStatus(404, 'ctx')).toThrow(NotFoundException);
  });

  it('throws ConflictException for 409', () => {
    expect(() => mapDialHttpStatus(409, 'ctx')).toThrow(ConflictException);
  });

  it('throws PayloadTooLargeException for 413', () => {
    expect(() => mapDialHttpStatus(413, 'ctx')).toThrow(
      PayloadTooLargeException,
    );
  });

  it('throws HttpException with 429 for too many requests', () => {
    try {
      mapDialHttpStatus(429, 'ctx');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
    }
  });

  it('throws BadGatewayException for 5xx', () => {
    expect(() => mapDialHttpStatus(503, 'ctx')).toThrow(BadGatewayException);
  });

  it('throws BadGatewayException for an unmapped status', () => {
    expect(() => mapDialHttpStatus(402, 'ctx')).toThrow(BadGatewayException);
  });

  it('logs a warning with the provided context when a logger is passed', () => {
    const logger = { warn: vi.fn(), error: vi.fn() } as unknown as Logger;
    expect(() => mapDialHttpStatus(404, 'my-context', logger)).toThrow(
      NotFoundException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'DIAL Core returned 404 for my-context',
    );
  });

  it('does not require a logger', () => {
    expect(() => mapDialHttpStatus(404, 'ctx')).toThrow(NotFoundException);
  });

  it('uses the upstream message for 400 instead of the generic text when provided', () => {
    try {
      mapDialHttpStatus(
        400,
        'ctx',
        undefined,
        undefined,
        "The specified endpoint 'https://x' is invalid or unreachable.",
      );
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(
        "The specified endpoint 'https://x' is invalid or unreachable.",
      );
    }
  });

  it('falls back to the generic 400 message when no upstream message is provided', () => {
    try {
      mapDialHttpStatus(400, 'ctx');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as BadRequestException).message).toBe(
        'Invalid request to DIAL Core',
      );
    }
  });

  it('does not use the upstream message for 401/403/404', () => {
    try {
      mapDialHttpStatus(404, 'ctx', undefined, undefined, 'internal detail');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as NotFoundException).message).toBe('Resource not found');
    }
  });

  it('logs the raw error body at warning level when provided', () => {
    const logger = { warn: vi.fn() } as unknown as Logger;
    expect(() =>
      mapDialHttpStatus(400, 'ctx', logger, { code: 'bad' }),
    ).toThrow(BadRequestException);
    expect(logger.warn).toHaveBeenCalledWith(
      'DIAL Core error body for ctx: {"code":"bad"}',
    );
  });
});

describe('handleDialSdkError', () => {
  it('re-throws HttpException instances unchanged', () => {
    const original = new ConflictException('already exists');
    try {
      handleDialSdkError(original, 'ctx');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBe(original);
    }
  });

  it('throws ServiceUnavailableException for TypeError', () => {
    expect(() =>
      handleDialSdkError(new TypeError('fetch failed'), 'ctx'),
    ).toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException for ECONNREFUSED', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:3000');
    expect(() => handleDialSdkError(err, 'ctx')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException for ENOTFOUND', () => {
    const err = new Error('getaddrinfo ENOTFOUND dial-core');
    expect(() => handleDialSdkError(err, 'ctx')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException for TimeoutError', () => {
    const err = Object.assign(new Error('The operation was aborted'), {
      name: 'TimeoutError',
    });
    expect(() => handleDialSdkError(err, 'ctx')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws NotFoundException for a 404 http-shaped error', () => {
    expect(() => handleDialSdkError({ status: 404 }, 'ctx')).toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException for a 400 http-shaped error', () => {
    expect(() => handleDialSdkError({ status: 400 }, 'ctx')).toThrow(
      BadRequestException,
    );
  });

  it('throws ConflictException for a 409 http-shaped error', () => {
    expect(() => handleDialSdkError({ status: 409 }, 'ctx')).toThrow(
      ConflictException,
    );
  });

  it('throws PayloadTooLargeException for a 413 http-shaped error', () => {
    expect(() => handleDialSdkError({ status: 413 }, 'ctx')).toThrow(
      PayloadTooLargeException,
    );
  });

  it('throws BadGatewayException for a 5xx http-shaped error', () => {
    expect(() => handleDialSdkError({ status: 503 }, 'ctx')).toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException for unknown errors', () => {
    expect(() => handleDialSdkError({ unexpected: true }, 'ctx')).toThrow(
      BadGatewayException,
    );
    expect(() => handleDialSdkError('string error', 'ctx')).toThrow(
      BadGatewayException,
    );
    expect(() => handleDialSdkError(null, 'ctx')).toThrow(BadGatewayException);
  });

  it('does not require a logger', () => {
    expect(() => handleDialSdkError({ status: 404 }, 'ctx')).toThrow(
      NotFoundException,
    );
  });

  it('uses response.status when the error body carries no status', () => {
    expect(() =>
      handleDialSdkError({ message: 'Resource not found' }, 'ctx', undefined, {
        status: 404,
      }),
    ).toThrow(NotFoundException);
  });

  it('lets a status on the error body win when response is also passed', () => {
    /*
     * response.status is the authoritative upstream status; this asserts
     * the merge always sets it last regardless of what the error body carries.
     */
    expect(() =>
      handleDialSdkError({ status: 400 }, 'ctx', undefined, { status: 409 }),
    ).toThrow(ConflictException);
  });

  it('falls back to BadGatewayException when neither the error body nor response carry a status', () => {
    expect(() => handleDialSdkError({ message: 'weird' }, 'ctx')).toThrow(
      BadGatewayException,
    );
  });
});

describe('handleDialFetchError', () => {
  it('re-throws HttpException instances unchanged', () => {
    const original = new ForbiddenException('nope');
    try {
      handleDialFetchError(original, 'ctx');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBe(original);
    }
  });

  it('throws ServiceUnavailableException with a timeout message for AbortError', () => {
    const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
    try {
      handleDialFetchError(err, 'ctx', undefined, 5000);
      expect.fail('should have thrown');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      expect((thrown as ServiceUnavailableException).message).toBe(
        'DIAL Core request timed out',
      );
    }
  });

  it('throws ServiceUnavailableException for an unexpected error', () => {
    const err = new Error('boom');
    try {
      handleDialFetchError(err, 'ctx');
      expect.fail('should have thrown');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      expect((thrown as ServiceUnavailableException).message).toBe(
        'DIAL Core is currently unavailable',
      );
    }
  });

  it('logs unexpected error type without raw upstream message details', () => {
    const logger = { error: vi.fn() } as unknown as Logger;
    const err = new Error('token=secret bucket=user-data');
    err.name = 'DialFetchError';

    try {
      handleDialFetchError(err, 'ctx', logger);
      expect.fail('should have thrown');
    } catch {
      expect(logger.error).toHaveBeenCalledWith(
        'Unexpected error during ctx: DialFetchError',
        err.stack,
      );
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('token=secret'),
        expect.anything(),
      );
    }
  });

  it('does not require a logger', () => {
    expect(() => handleDialFetchError(new Error('boom'), 'ctx')).toThrow(
      ServiceUnavailableException,
    );
  });
});
