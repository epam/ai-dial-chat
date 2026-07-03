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

  it('does not require a logger', () => {
    expect(() => handleDialFetchError(new Error('boom'), 'ctx')).toThrow(
      ServiceUnavailableException,
    );
  });
});
