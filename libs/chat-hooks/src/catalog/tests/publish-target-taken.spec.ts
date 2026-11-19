import { describe, expect, it, vi } from 'vitest';
import {
  PublishTargetTakenError,
  isPublishInProgressDetails,
  isPublishTargetTakenResponse,
  wrapPublishTargetTaken,
} from '../publish-target-taken';

const failure = (status: number, body: Record<string, unknown>) =>
  Object.assign(new Error('failed'), {
    response: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

const taken = () =>
  failure(409, {
    statusCode: 409,
    message: 'taken',
    error: 'Conflict',
    code: 'target-exists',
  });

describe('isPublishTargetTakenResponse', () => {
  it('recognises the target-exists 409', async () => {
    await expect(isPublishTargetTakenResponse(taken())).resolves.toBe(true);
  });

  it('ignores another 409 code', async () => {
    await expect(
      isPublishTargetTakenResponse(
        failure(409, { message: 'x', code: 'name-taken-agent' }),
      ),
    ).resolves.toBe(false);
  });

  it('ignores a 409 without a code', async () => {
    await expect(
      isPublishTargetTakenResponse(failure(409, { message: 'x' })),
    ).resolves.toBe(false);
  });

  it('ignores a different status carrying the code', async () => {
    await expect(
      isPublishTargetTakenResponse(
        failure(400, { message: 'x', code: 'target-exists' }),
      ),
    ).resolves.toBe(false);
  });

  it('ignores a plain error', async () => {
    await expect(isPublishTargetTakenResponse(new Error('x'))).resolves.toBe(
      false,
    );
  });
});

describe('wrapPublishTargetTaken', () => {
  it('passes the arguments through and resolves with the result', async () => {
    const publish = vi.fn().mockResolvedValue('done');

    await expect(wrapPublishTargetTaken(publish)('a', 1)).resolves.toBe('done');
    expect(publish).toHaveBeenCalledWith('a', 1);
  });

  it('rejects the taken-target 409 as a PublishTargetTakenError keeping the cause', async () => {
    const original = taken();
    const wrapped = wrapPublishTargetTaken(vi.fn().mockRejectedValue(original));

    const error = await wrapped().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublishTargetTakenError);
    expect((error as PublishTargetTakenError).cause).toBe(original);
  });

  it('rethrows every other failure unchanged', async () => {
    const original = failure(502, { message: 'bad gateway' });
    const wrapped = wrapPublishTargetTaken(vi.fn().mockRejectedValue(original));

    await expect(wrapped()).rejects.toBe(original);
  });
});

describe('isPublishInProgressDetails', () => {
  it('is true for a 409 with the publish-in-progress code', () => {
    expect(
      isPublishInProgressDetails({ status: 409, code: 'publish-in-progress' }),
    ).toBe(true);
  });

  it.each([
    { status: 409, code: 'target-exists' },
    { status: 409 },
    { status: 400, code: 'publish-in-progress' },
  ])('is false for %o', (details) => {
    expect(isPublishInProgressDetails(details)).toBe(false);
  });
});
