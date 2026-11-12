import {
  ForbiddenException,
  NotFoundException,
  type Logger,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationErrorCode } from '../types/application-error-code.enum';
import {
  DEPENDENT_RESOURCE_MISSING_MESSAGE,
  isDependentResourceError,
  throwApplicationSaveError,
} from '../utils/application-save-error';

const PREFIX = 'Failed to access application resource';

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

  it('rejects a JSON object body even when it carries the text', () => {
    expect(isDependentResourceError({ message: `${PREFIX} x` })).toBe(false);
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
