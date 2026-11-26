import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  dialAnalyticsErrors,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../dial-error.mapper';

const CONTEXT = 'DIAL Analytics POST /v1/queries/execute';

const thrown = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
};

const messageOf = (error: unknown): string =>
  error instanceof HttpException ? JSON.stringify(error.getResponse()) : '';

const makeLogger = () => {
  const logger = new Logger('test');
  const spies = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map(
    (level) => vi.spyOn(logger, level).mockImplementation(() => undefined),
  );
  return {
    logger,
    logged: () => JSON.stringify(spies.flatMap((spy) => spy.mock.calls)),
  };
};

describe('dialAnalyticsErrors', () => {
  it.each([400, 401, 403, 404, 405, 409, 412, 413, 422, 429, 302, 500, 503])(
    'maps status %i to the same exception subtype as DIAL Core',
    (status) => {
      const analytics = thrown(() =>
        dialAnalyticsErrors.mapHttpStatus(status, CONTEXT),
      );
      const core = thrown(() => mapDialHttpStatus(status, CONTEXT));

      expect(analytics?.constructor).toBe(core?.constructor);
    },
  );

  it.each([
    [400, BadRequestException],
    [401, UnauthorizedException],
    [403, ForbiddenException],
    [404, NotFoundException],
    [500, BadGatewayException],
  ])(
    'never names DIAL Core for status %i, in messages or logs',
    (status, exception) => {
      const { logger, logged } = makeLogger();
      const error = thrown(() =>
        dialAnalyticsErrors.mapHttpStatus(status, CONTEXT, logger),
      );

      expect(error).toBeInstanceOf(exception);
      expect(messageOf(error)).not.toContain('DIAL Core');
      expect(logged()).not.toContain('DIAL Core');
    },
  );

  it('names DIAL Analytics in its server-error and bad-request texts', () => {
    expect(
      messageOf(thrown(() => dialAnalyticsErrors.mapHttpStatus(500, CONTEXT))),
    ).toContain('DIAL Analytics returned a server error');
    expect(
      messageOf(thrown(() => dialAnalyticsErrors.mapHttpStatus(400, CONTEXT))),
    ).toContain('Invalid request to DIAL Analytics');
  });

  it.each(['TimeoutError', 'AbortError'])(
    'treats a %s rejection as a timeout',
    (name) => {
      const rejection = Object.assign(new Error('aborted'), { name });
      const error = thrown(() =>
        dialAnalyticsErrors.handleFetchError(
          rejection,
          CONTEXT,
          undefined,
          1000,
        ),
      );

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(messageOf(error)).toContain('DIAL Analytics request timed out');
    },
  );

  it.each([
    ['a refused connection', new TypeError('fetch failed')],
    [
      'a body that is not JSON',
      new SyntaxError('Unexpected end of JSON input'),
    ],
  ])('answers %s as currently unavailable', (_label, rejection) => {
    const error = thrown(() =>
      dialAnalyticsErrors.handleFetchError(rejection, CONTEXT),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(messageOf(error)).toContain(
      'DIAL Analytics is currently unavailable',
    );
  });

  it('re-throws an HttpException unchanged', () => {
    const original = new ForbiddenException();

    expect(
      thrown(() => dialAnalyticsErrors.handleFetchError(original, CONTEXT)),
    ).toBe(original);
  });

  it('leaves the DIAL Core fetch handler treating only AbortError as a timeout', () => {
    const rejection = Object.assign(new Error('aborted'), {
      name: 'TimeoutError',
    });
    const error = thrown(() =>
      handleDialFetchError(rejection, 'ctx', undefined, 1000),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(messageOf(error)).toContain('DIAL Core is currently unavailable');
  });
});
