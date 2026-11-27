import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildAnthropicMessagesUrl,
  buildChatCompletionsUrl,
  buildDeploymentConnectApi,
} from '../deployment-endpoint-url';

const baseUrl = 'https://dial.example.com';

/* Runs the snippet in a POSIX shell with `curl` stubbed to print its arguments NUL-separated,
 * so the shell itself, not a test-side inverse of the quoting, decides what each argument is. */
const readCurlArguments = (code: string): string[] => {
  const stub = 'curl() { printf "%s\\0" "$@"; }';
  const { status, stdout } = spawnSync('/bin/sh', ['-c', `${stub}\n${code}`], {
    encoding: 'utf8',
  });
  expect(status).toBe(0);
  return stdout.split('\0').slice(0, -1);
};

describe('deployment Connect endpoints', () => {
  it.each([
    [false, false, false, []],
    [true, false, false, ['Chat Completions']],
    [false, true, false, ['Responses']],
    [false, false, true, ['Anthropic Messages']],
    [true, true, false, ['Chat Completions', 'Responses']],
    [true, false, true, ['Chat Completions', 'Anthropic Messages']],
    [false, true, true, ['Responses', 'Anthropic Messages']],
    [true, true, true, ['Chat Completions', 'Responses', 'Anthropic Messages']],
  ] as const)(
    'gates APIs independently: %s/%s/%s',
    (hasChatCompletion, hasResponsesApi, hasAnthropicMessages, names) => {
      const api = buildDeploymentConnectApi(baseUrl, 'selected-model', {
        hasChatCompletion,
        hasResponsesApi,
        hasAnthropicMessages,
      });
      expect(api?.endpoints?.map((endpoint) => endpoint.label) ?? []).toEqual(
        names,
      );
      if (names.length === 0) expect(api).toBeUndefined();
    },
  );

  it('keeps three-argument legacy calls and existing ID encoding compatible', () => {
    expect(buildDeploymentConnectApi(baseUrl, 'legacy', {})).toBeUndefined();
    const api = buildDeploymentConnectApi(baseUrl, 'legacy', {
      hasChatCompletion: true,
      hasResponsesApi: true,
    });
    expect(api?.endpoints).toHaveLength(2);
    expect(
      buildChatCompletionsUrl(baseUrl, 'applications/public/qa%202.0'),
    ).toBe(
      `${baseUrl}/openai/deployments/applications/public/qa%202.0/chat/completions`,
    );
  });

  it.each([baseUrl, baseUrl + '/', ''])(
    'uses the supplied Core base %s',
    (base) => {
      const expected = base
        ? baseUrl + '/anthropic/v1/messages'
        : '/anthropic/v1/messages';
      expect(buildAnthropicMessagesUrl(base)).toBe(expected);
      expect(
        buildDeploymentConnectApi(base, 'selected-model', {
          hasAnthropicMessages: true,
        })?.endpoints?.[0]?.url,
      ).toBe(expected);
    },
  );

  it('provides required request fields and DIAL authentication without upstream settings', () => {
    const api = buildDeploymentConnectApi(baseUrl, 'selected-model', {
      hasAnthropicMessages: true,
    });
    const code = api?.endpoints?.[0]?.snippets?.[0]?.code ?? '';
    expect(code).toContain('Content-Type: application/json');
    expect(code).toContain('Api-Key: <key>');
    expect(code).toContain('anthropic-version: 2023-06-01');
    expect(code).not.toMatch(
      /api-version=|X-UPSTREAM|Authorization:|MODEL_CATALOG_API_KEY/,
    );
    expect(code).toContain(
      `-d '${JSON.stringify({
        model: 'selected-model',
        max_tokens: 128,
        messages: [{ role: 'user', content: 'Hello' }],
      })}'`,
    );
  });

  describe.skipIf(process.platform === 'win32')(
    'Messages cURL example in a POSIX shell',
    () => {
      it.each([
        'applications/public/qa%202.0',
        'model "quoted" \\ value',
        "model's name",
        "model'; echo injected; '",
        'model $(printf injected) `printf injected`',
      ])('passes deployment ID %s to curl as inert arguments', (id) => {
        const coreBase = baseUrl + "/tenant's-core";
        const api = buildDeploymentConnectApi(coreBase, id, {
          hasAnthropicMessages: true,
        });
        const code = api?.endpoints?.[0]?.snippets?.[0]?.code ?? '';
        expect(readCurlArguments(code)).toEqual([
          '-X',
          'POST',
          `${coreBase}/anthropic/v1/messages`,
          '-H',
          'Content-Type: application/json',
          '-H',
          'Api-Key: <key>',
          '-H',
          'anthropic-version: 2023-06-01',
          '-d',
          JSON.stringify({
            model: id,
            max_tokens: 128,
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        ]);
      });
    },
  );

  it('supports translated labels, partial overrides and English defaults', () => {
    const api = buildDeploymentConnectApi(
      baseUrl,
      'mixed',
      {
        hasChatCompletion: true,
        hasResponsesApi: true,
        hasAnthropicMessages: true,
      },
      {
        chatCompletions: 'Chat traduit',
        responses: 'Réponses',
        anthropicMessages: 'Messages traduits',
      },
    );
    expect(api?.endpoints?.map((endpoint) => endpoint.label)).toEqual([
      'Chat traduit',
      'Réponses',
      'Messages traduits',
    ]);
    expect(
      buildDeploymentConnectApi(
        baseUrl,
        'messages',
        { hasAnthropicMessages: true },
        { anthropicMessages: undefined },
      )?.endpoints?.[0]?.label,
    ).toBe('Anthropic Messages');
  });
});
