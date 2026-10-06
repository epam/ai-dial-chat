import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { ApiResponse, DECORATORS } from '@nestjs/swagger';
import { describe, expect, it } from 'vitest';
import {
  ApiDialCoreErrors,
  DIAL_CORE_ERROR_STATUSES,
  DIAL_CORE_RETRY_AFTER_HEADER,
} from '../api-dial-core-errors.decorator';

class UpstreamErrorDto {}

class TestController {
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Specific not found' })
  declaredFirst(): void {
    return undefined;
  }

  @ApiDialCoreErrors({
    exclude: [HttpStatus.PAYLOAD_TOO_LARGE],
    include: [HttpStatus.PRECONDITION_FAILED],
    hasRetryAfter: true,
    errorType: UpstreamErrorDto,
  })
  withOptions(): void {
    return undefined;
  }
}

const responsesOf = (
  method: keyof TestController,
): Record<string, Record<string, unknown>> =>
  Reflect.getMetadata(
    DECORATORS.API_RESPONSE,
    TestController.prototype[method],
  ) as Record<string, Record<string, unknown>>;

describe('ApiDialCoreErrors', () => {
  it('declares every default DIAL Core pass-through status', () => {
    const responses = responsesOf('declaredFirst');
    for (const status of DIAL_CORE_ERROR_STATUSES) {
      expect(responses[String(status)]).toBeDefined();
    }
    expect(responses['200']).toBeDefined();
  });

  it('keeps a status the handler already declares unchanged', () => {
    expect(responsesOf('declaredFirst')['404'].description).toBe(
      'Specific not found',
    );
  });

  it('declares a plain 429 without a Retry-After header by default', () => {
    expect(responsesOf('declaredFirst')['429'].headers).toBeUndefined();
  });

  it('honours exclude, include, hasRetryAfter, and errorType', () => {
    const responses = responsesOf('withOptions');
    expect(responses['413']).toBeUndefined();
    expect(responses['412']).toBeDefined();
    expect(responses['429'].headers).toEqual(DIAL_CORE_RETRY_AFTER_HEADER);
    expect(responses['409'].type).toBe(UpstreamErrorDto);
    // 401/403/404 never carry upstream text, so they keep the plain body.
    expect(responses['404'].type).toBeUndefined();
  });
});
