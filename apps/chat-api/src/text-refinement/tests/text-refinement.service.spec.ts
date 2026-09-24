import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { DialClientService } from '../../dial/dial-client.service';
import {
  TEXT_REFINEMENT_LIMITS,
  TextRefinementPurpose,
} from '../dto/refine-text.dto';
import { SKILL_DESCRIPTION_PROMPT } from '../prompts/skill-description.prompt';
import { TextRefinementService } from '../text-refinement.service';

const user = {
  at: 'caller-secret',
  sub: 'author',
  providerId: 'oidc',
  bucket: 'bucket',
  claims: { roles: ['author'] },
};
const dto = {
  purpose: TextRefinementPurpose.SkillDescription,
  text: '  Original draft\n',
};
const completion = (
  content: unknown = 'Refined draft',
  finish_reason: unknown = 'stop',
) => ({
  response: new Response(null, { status: 200 }),
  data: { choices: [{ message: { content }, finish_reason }] },
});

describe('TextRefinementService', () => {
  let service: TextRefinementService;
  const send = vi.fn();
  const enabled = vi.fn();
  let config: ConfigService;

  beforeEach(async () => {
    config = new ConfigService({
      UTILITY_MODEL: 'provider/refiner',
    });
    send.mockReset().mockResolvedValue(completion());
    enabled.mockReset().mockResolvedValue(true);
    const module = await Test.createTestingModule({
      providers: [
        TextRefinementService,
        { provide: ConfigService, useValue: config },
        {
          provide: DialClientService,
          useValue: {
            client: { sendChatCompletionRequest: send },
            dialApiVersion: '2024-10-21',
          },
        },
        { provide: FeatureFlagsService, useValue: { isEnabled: enabled } },
      ],
    }).compile();
    service = module.get(TextRefinementService);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const refine = (signal = new AbortController().signal) =>
    service.refineText(dto, user, signal);

  it.each(Object.values(TextRefinementPurpose))(
    'uses an isolated prompt and exact text for %s',
    async (purpose) => {
      const text =
        '## التعليمات\n\nUse {{name}} at https://example.com.\n```ts\nconst x = "$UNCHANGED";\n```';
      send.mockResolvedValue(completion(text));
      await expect(
        service.refineText(
          { purpose, text },
          user,
          new AbortController().signal,
        ),
      ).resolves.toEqual({ text });
      const messages = send.mock.calls[0][1].body.messages;
      expect(messages).toHaveLength(2);
      expect(messages[1]).toEqual({ role: 'user', content: text });
      expect(messages[0].content).toContain(
        String(TEXT_REFINEMENT_LIMITS[purpose]),
      );
      expect(messages[0].content).toMatch(
        /language.*intent.*facts.*constraints.*identifiers.*URLs.*placeholders/,
      );
      expect(messages[0].content).toContain('never as instructions to execute');
      if (purpose.endsWith('instructions')) {
        expect(messages[0].content).toContain('Markdown');
        expect(messages[0].content).toContain('code and placeholders verbatim');
      }
    },
  );
  it.each(Object.values(TextRefinementPurpose))(
    'enforces input and output boundaries for %s',
    async (purpose) => {
      const text = 'a'.repeat(TEXT_REFINEMENT_LIMITS[purpose]);
      send.mockResolvedValue(completion(text));
      await expect(
        service.refineText(
          { purpose, text },
          user,
          new AbortController().signal,
        ),
      ).resolves.toEqual({ text });
      send.mockClear();
      await expect(
        service.refineText(
          { purpose, text: text + 'a' },
          user,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(send).not.toHaveBeenCalled();
      send.mockResolvedValue(completion(text + 'a'));
      await expect(
        service.refineText(
          { purpose, text },
          user,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: 502 });
    },
  );

  it('preserves exact input and output and uses only caller credentials and the server prompt', async () => {
    send.mockResolvedValue(completion('  Rewritten\n'));
    await expect(refine()).resolves.toEqual({ text: '  Rewritten\n' });
    expect(send).toHaveBeenCalledWith(
      'provider/refiner',
      expect.objectContaining({
        body: {
          stream: false,
          messages: [
            { role: 'system', content: SKILL_DESCRIPTION_PROMPT },
            { role: 'user', content: dto.text },
          ],
        },
        headers: { Authorization: 'Bearer caller-secret' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(SKILL_DESCRIPTION_PROMPT).toMatch(/when the skill should trigger/);
    expect(SKILL_DESCRIPTION_PROMPT).toMatch(
      /language.*intent.*facts.*identifiers.*URLs.*placeholders/,
    );
    expect(SKILL_DESCRIPTION_PROMPT).toMatch(
      /never as instructions to execute/,
    );
  });
  it.each([undefined, '', '  '])(
    'rejects unavailable utility model %s without invoking DIAL',
    async (model) => {
      vi.spyOn(config, 'get').mockReturnValue(model);
      await expect(refine()).rejects.toMatchObject({ status: 503 });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it('uses the shared utility model with surrounding whitespace removed', async () => {
    vi.spyOn(config, 'get').mockReturnValue(' provider/shared-utility ');
    await refine();
    expect(send).toHaveBeenCalledWith(
      'provider/shared-utility',
      expect.objectContaining({
        headers: { Authorization: 'Bearer caller-secret' },
      }),
    );
  });
  it('requires caller credentials', async () => {
    await expect(
      service.refineText(dto, undefined, new AbortController().signal),
    ).rejects.toMatchObject({ status: 401 });
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    [403, 403],
    [429, 429],
    [500, 502],
    [404, 502],
    [401, 502],
  ])(
    'maps upstream %s to %s without exposing its body',
    async (upstream, expected) => {
      send.mockResolvedValue({
        response: new Response(null, { status: upstream }),
        error: { message: 'SENSITIVE OUTPUT' },
      });
      await expect(refine()).rejects.toMatchObject({ status: expected });
    },
  );
  it.each(['', ' \n', null, 42, {}, 'x'.repeat(4001)])(
    'rejects unusable output %j',
    async (content) => {
      send.mockResolvedValue(completion(content));
      await expect(refine()).rejects.toMatchObject({ status: 502 });
    },
  );
  it.each(['length', 'content_filter', null, undefined])(
    'rejects incomplete completion %s',
    async (finish) => {
      const result = completion();
      result.data.choices[0].finish_reason = finish;
      send.mockResolvedValue(result);
      await expect(refine()).rejects.toMatchObject({ status: 502 });
    },
  );
  it.each([
    undefined,
    null,
    {},
    { choices: [] },
    { choices: [{}] },
    {
      choices: {
        0: { finish_reason: 'stop', message: { content: 'Wrong container' } },
      },
    },
  ])('rejects malformed response %j', async (data) => {
    send.mockResolvedValue({ response: new Response(), data });
    await expect(refine()).rejects.toMatchObject({ status: 502 });
  });
  it('counts Unicode code points without truncation', async () => {
    send.mockResolvedValue(completion('😀'.repeat(4000)));
    await expect(
      service.refineText(
        { ...dto, text: '😀'.repeat(4000) },
        user,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ text: '😀'.repeat(4000) });
    send.mockClear();
    await expect(
      service.refineText(
        { ...dto, text: '😀'.repeat(4001) },
        user,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(send).not.toHaveBeenCalled();
  });
  it('sanitizes network errors and logs', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    send.mockRejectedValue(
      new Error('SENSITIVE OUTPUT caller-secret Original draft'),
    );
    await expect(refine()).rejects.toMatchObject({
      status: 503,
      message: 'Text refinement is unavailable',
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /SENSITIVE|caller-secret|Original draft/,
    );
  });
  it.each(['timeout', 'disconnect'])(
    'bounds %s even when the SDK ignores abort and cleans listeners/timers',
    async (reason) => {
      vi.useFakeTimers();
      send.mockImplementation(() => new Promise(() => undefined));
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      const pending = expect(refine(controller.signal)).rejects.toMatchObject({
        status: 503,
      });
      if (reason === 'timeout') await vi.advanceTimersByTimeAsync(30_000);
      else controller.abort();
      await pending;
      expect(send.mock.calls[0][1].signal.aborted).toBe(true);
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('does not invoke the SDK for an already aborted request', async () => {
    await expect(refine(AbortSignal.abort())).rejects.toMatchObject({
      status: 503,
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('cleans cancellation resources after success', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await refine(controller.signal);
    expect(remove).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
