import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import {
  CustomApiBody,
  CustomApiMethod,
  type CustomApiOperation,
} from '../custom-api-registry.service';
import {
  CUSTOM_API_MAX_BODY_BYTES,
  CUSTOM_API_MAX_QUERY_VALUE_BYTES,
  parseCustomApiRequest,
} from '../custom-api-request';

const GET_OPERATION: CustomApiOperation = {
  id: 'loop-probe',
  method: CustomApiMethod.Get,
  corePath: '/dial-loop/editor/probe',
  query: ['url', 'service'],
  body: CustomApiBody.None,
  timeoutMs: 10_000,
  maxResponseBytes: 1_048_576,
};

const PUT_OPERATION: CustomApiOperation = {
  ...GET_OPERATION,
  id: 'loop-teams-binding-put',
  method: CustomApiMethod.Put,
  query: [],
  body: CustomApiBody.Json,
};

/* A request double: `is` answers like Express's type check for JSON. */
const requestWith = ({
  query = {},
  body = {},
  headers = {},
  isJson = false,
}: {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  isJson?: boolean;
}) =>
  ({
    query,
    body,
    headers,
    is: (type: string) =>
      isJson && type === 'application/json' ? type : false,
  }) as unknown as Request;

const nestedJson = (depth: number): unknown => {
  let value: unknown = {};
  for (let i = 1; i < depth; i += 1) value = { child: value };
  return value;
};

describe('parseCustomApiRequest', () => {
  describe('query', () => {
    it('forwards allowlisted names in configuration order', () => {
      const { query } = parseCustomApiRequest(
        requestWith({
          query: { service: 'git', url: 'https://svc.example/a b' },
        }),
        GET_OPERATION,
      );
      expect(query.toString()).toBe(
        'url=https%3A%2F%2Fsvc.example%2Fa+b&service=git',
      );
    });

    it('forwards nothing when the caller passes no query', () => {
      const { query } = parseCustomApiRequest(requestWith({}), GET_OPERATION);
      expect(query.toString()).toBe('');
    });

    it('rejects a name outside the allowlist', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ query: { url: 'x', path: '/etc' } }),
          GET_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects every query on an operation that allows none', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ query: { parameters: 'anything' } }),
          { ...GET_OPERATION, query: [] },
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects a repeated name', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ query: { url: ['a', 'b'] } }),
          GET_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects a value over the per-value byte limit', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({
            query: {
              url: 'é'.repeat(CUSTOM_API_MAX_QUERY_VALUE_BYTES / 2 + 1),
            },
          }),
          GET_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects a query over the total byte limit', () => {
      const value = '/'.repeat(CUSTOM_API_MAX_QUERY_VALUE_BYTES);
      expect(() =>
        parseCustomApiRequest(
          requestWith({ query: { url: value, service: value } }),
          GET_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('body', () => {
    it('re-serializes the JSON body of a body:"json" operation', () => {
      const { body } = parseCustomApiRequest(
        requestWith({ body: { enabled: true }, isJson: true }),
        PUT_OPERATION,
      );
      expect(body).toBe('{"enabled":true}');
    });

    it('accepts a JSON array body', () => {
      const { body } = parseCustomApiRequest(
        requestWith({ body: [1, 2], isJson: true }),
        PUT_OPERATION,
      );
      expect(body).toBe('[1,2]');
    });

    it('rejects a body:"json" request that is not declared as JSON', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({
            body: 'enabled=true',
            headers: { 'content-length': '12' },
          }),
          PUT_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects a body over the byte limit', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({
            body: { blob: 'x'.repeat(CUSTOM_API_MAX_BODY_BYTES) },
            isJson: true,
          }),
          PUT_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects a body nested deeper than 32 levels', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ body: nestedJson(33), isJson: true }),
          PUT_OPERATION,
        ),
      ).toThrow(BadRequestException);
    });

    it('accepts a body nested exactly 32 levels', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ body: nestedJson(32), isJson: true }),
          PUT_OPERATION,
        ),
      ).not.toThrow();
    });

    it('rejects any body on an operation without body:"json"', () => {
      expect(() =>
        parseCustomApiRequest(
          requestWith({ body: { enabled: true }, isJson: true }),
          { ...PUT_OPERATION, body: CustomApiBody.None },
        ),
      ).toThrow(BadRequestException);
    });

    it('leaves the body out for a bodiless write', () => {
      const input = parseCustomApiRequest(requestWith({}), {
        ...PUT_OPERATION,
        method: CustomApiMethod.Post,
        body: CustomApiBody.None,
      });
      expect(input).toEqual({ query: new URLSearchParams() });
    });
  });
});
