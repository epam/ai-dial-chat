import { describe, expect, it } from 'vitest';
import {
  canonicalByteLength,
  canonicalJson,
  canonicalSha256,
} from '../../managed-config/canonical-json';

/* Fixed vector computed with Config Studio's canonical algorithm. */
const VECTOR_INPUT = JSON.parse('{"b":1,"a":[{"d":"x","c":null}],"é":"ü"}');
const VECTOR_CANONICAL = '{"a":[{"c":null,"d":"x"}],"b":1,"é":"ü"}';
const VECTOR_SHA256 =
  'b69925e54531b6b61268fda5dca74b8d1eb6d566616ec5932258abac6c9edde0';

describe('canonicalJson', () => {
  it('matches the Config Studio vector', () => {
    expect(canonicalJson(VECTOR_INPUT)).toBe(VECTOR_CANONICAL);
    expect(canonicalSha256(VECTOR_INPUT)).toBe(VECTOR_SHA256);
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(canonicalByteLength(VECTOR_INPUT)).toBe(
      Buffer.byteLength(VECTOR_CANONICAL, 'utf8'),
    );
    expect(canonicalByteLength(VECTOR_INPUT)).toBe(VECTOR_CANONICAL.length + 2);
  });

  it('sorts keys by UTF-16 code unit, not by locale', () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3, _: 4, é: 5 })).toBe(
      '{"B":2,"_":4,"a":3,"b":1,"é":5}',
    );
  });

  it('sorts nested keys and keeps array order', () => {
    expect(
      canonicalJson({ z: [{ y: 1, x: 2 }, 3], a: { d: true, c: 'x' } }),
    ).toBe('{"a":{"c":"x","d":true},"z":[{"x":2,"y":1},3]}');
  });

  it('serializes primitives as JSON.stringify does', () => {
    expect(canonicalJson('a"b\\n')).toBe(JSON.stringify('a"b\\n'));
    expect(canonicalJson(1e21)).toBe('1e+21');
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(null)).toBe('null');
  });

  it('skips undefined members and writes undefined array items as null', () => {
    expect(canonicalJson({ a: undefined, b: [undefined] })).toBe(
      '{"b":[null]}',
    );
  });

  it('is independent of key insertion order', () => {
    expect(canonicalSha256({ a: 1, b: 2 })).toBe(
      canonicalSha256({ b: 2, a: 1 }),
    );
  });

  it('rejects a value with no JSON form', () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
  });
});
