import {
  ForbiddenException,
  NotFoundException,
  type Logger,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationErrorCode } from '../types/application-error-code.enum';
import {
  DEPENDENT_RESOURCE_MISSING_MESSAGE,
  RESOURCE_DEPENDENCIES_NOT_ALLOWED_MESSAGE,
  isDependentResourceError,
  isResourceDependenciesNotAllowedError,
  throwApplicationSaveError,
} from '../utils/application-save-error';

const PREFIX = 'Failed to access application resource';

const NOT_ALLOWED_BODY =
  'User-authored applications may not change resource dependencies (applications.allowUserAuthoredDependencies is disabled)';

const makeLogger = () =>
  ({ warn: vi.fn(), error: vi.fn() }) as unknown as Logger;

describe('isDependentResourceError', () => {
  it('matches the Core text with a resource path', () => {
    expect(isDependentResourceError(`${PREFIX} files/b/doc.pdf`)).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isDependentResourceError(`  ${PREFIX.toUpperCase()} x\n`)).toBe(
      true,
    );
  });

  it('rejects another Core text', () => {
    expect(
      isDependentResourceError("You don't have an access to: files/b/x.pdf"),
    ).toBe(false);
  });

  it('matches a JSON body carrying the text in message', () => {
    expect(isDependentResourceError({ message: `${PREFIX} x` })).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(isDependentResourceError(undefined)).toBe(false);
  });
});

describe('throwApplicationSaveError', () => {
  it('throws the coded 403 for a missing dependency without the resource path', () => {
    const logger = makeLogger();

    const act = () =>
      throwApplicationSaveError(
        403,
        `${PREFIX} files/b/secret-name.pdf`,
        'update application "a"',
        logger,
      );

    expect(act).toThrow(ForbiddenException);
    try {
      act();
    } catch (error) {
      const response = (error as ForbiddenException).getResponse() as Record<
        string,
        unknown
      >;
      expect(response).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        code: ApplicationErrorCode.DependentResourceMissing,
        message: DEPENDENT_RESOURCE_MISSING_MESSAGE,
      });
    }
    expect(vi.mocked(logger.warn).mock.calls.join(' ')).not.toContain(
      'secret-name',
    );
  });

  it('keeps the generic 403 for another body', () => {
    expect(() =>
      throwApplicationSaveError(
        403,
        'Forbidden',
        'create application',
        makeLogger(),
      ),
    ).toThrow(ForbiddenException);
  });

  it('does not code a matching text on another status', () => {
    expect(() =>
      throwApplicationSaveError(
        404,
        `${PREFIX} x`,
        'create application',
        makeLogger(),
      ),
    ).toThrow(NotFoundException);
  });
});

describe('isResourceDependenciesNotAllowedError', () => {
  it('matches the Core text', () => {
    expect(isResourceDependenciesNotAllowedError(NOT_ALLOWED_BODY)).toBe(true);
  });

  it('ignores case and separators in the setting name', () => {
    expect(
      isResourceDependenciesNotAllowedError({
        message: 'x ALLOW_user-authored dependencies y',
      }),
    ).toBe(true);
  });

  it('rejects the missing-dependency text and an empty body', () => {
    expect(isResourceDependenciesNotAllowedError(`${PREFIX} x`)).toBe(false);
    expect(isResourceDependenciesNotAllowedError(undefined)).toBe(false);
  });
});

describe('throwApplicationSaveError for refused dependency changes', () => {
  it('throws the coded 403 without repeating the Core text', () => {
    const act = () =>
      throwApplicationSaveError(
        403,
        NOT_ALLOWED_BODY,
        'update application "a"',
        makeLogger(),
      );

    expect(act).toThrow(ForbiddenException);
    try {
      act();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        code: ApplicationErrorCode.ResourceDependenciesNotAllowed,
        message: RESOURCE_DEPENDENCIES_NOT_ALLOWED_MESSAGE,
      });
    }
  });

  it('keeps the missing-dependency mapping unchanged', () => {
    try {
      throwApplicationSaveError(
        403,
        `${PREFIX} files/b/x.pdf`,
        'update application "a"',
        makeLogger(),
      );
    } catch (error) {
      expect(
        ((error as ForbiddenException).getResponse() as { code: string }).code,
      ).toBe(ApplicationErrorCode.DependentResourceMissing);
    }
  });

  it('leaves an unrelated 403 uncoded', () => {
    try {
      throwApplicationSaveError(
        403,
        'Forbidden',
        'update application "a"',
        makeLogger(),
      );
      expect.unreachable();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).not.toHaveProperty(
        'code',
      );
    }
  });

  it('does not code the text on another status', () => {
    expect(() =>
      throwApplicationSaveError(404, NOT_ALLOWED_BODY, 'x', makeLogger()),
    ).toThrow(NotFoundException);
  });
});
