import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { handleDialError } from './dial-error';

describe('handleDialError', () => {
  it('throws ServiceUnavailableException for TypeError', () => {
    expect(() => handleDialError(new TypeError('fetch failed'))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException for ECONNREFUSED', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:3000');
    expect(() => handleDialError(err)).toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException for ENOTFOUND', () => {
    const err = new Error('getaddrinfo ENOTFOUND dial-core');
    expect(() => handleDialError(err)).toThrow(ServiceUnavailableException);
  });

  it('throws NotFoundException for 404 http error', () => {
    expect(() => handleDialError({ status: 404 })).toThrow(NotFoundException);
  });

  it('throws BadRequestException for 400 http error', () => {
    expect(() => handleDialError({ status: 400 })).toThrow(BadRequestException);
  });

  it('throws ServiceUnavailableException for 5xx http error', () => {
    expect(() => handleDialError({ status: 503 })).toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws BadGatewayException for unknown errors', () => {
    expect(() => handleDialError({ unexpected: true })).toThrow(
      BadGatewayException,
    );
    expect(() => handleDialError('string error')).toThrow(BadGatewayException);
    expect(() => handleDialError(null)).toThrow(BadGatewayException);
  });
});
