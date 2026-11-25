import { once } from 'events';
import { get, type IncomingHttpHeaders, type IncomingMessage } from 'http';
import type { AddressInfo } from 'net';
import { gunzipSync } from 'zlib';
import express, { type Express } from 'express';
import { describe, expect, it } from 'vitest';
import { pipeWebBody } from '../../common/utils/stream';
import {
  createResponseCompressionMiddleware,
  RESPONSE_COMPRESSION_THRESHOLD_BYTES,
} from '../response-compression';

const LARGE_LIST = {
  deployments: Array.from({ length: 200 }, (_, index) => ({
    id: `deployment-${index}`,
    description: 'A research assistant that answers questions about data.',
  })),
};

const PRE_ENCODED_BODY = Buffer.from('pre-encoded');

const PROXIED_JSON_FILE = Buffer.from(JSON.stringify(LARGE_LIST));

const createTestApp = (): Express => {
  const app = express();
  app.use(createResponseCompressionMiddleware());
  app.get('/json', (_req, res) => {
    res.json(LARGE_LIST);
  });
  app.get('/problem-json', (_req, res) => {
    res.type('application/problem+json').send(JSON.stringify(LARGE_LIST));
  });
  app.get('/small-json', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/sse', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify(LARGE_LIST)}\n\n`);
    res.end();
  });
  app.get('/text', (_req, res) => {
    res.type('text/plain').send('x'.repeat(4096));
  });
  app.get('/ranged-json', (_req, res) => {
    const body = JSON.stringify(LARGE_LIST);
    res.status(206);
    res.setHeader(
      'Content-Range',
      `bytes 0-${body.length - 1}/${body.length * 2}`,
    );
    res.type('application/json').send(body);
  });
  /* The shape of GET /api/v1/files/download: DIAL Core's headers copied,
     then the web body piped through `pipeWebBody`. */
  app.get('/proxied-json-file', async (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', String(PROXIED_JSON_FILE.length));
    await pipeWebBody(new Blob([PROXIED_JSON_FILE]).stream(), res);
  });
  app.get('/encoded-json', (_req, res) => {
    res.setHeader('Content-Encoding', 'gzip');
    res.type('application/json').send(PRE_ENCODED_BODY);
  });
  return app;
};

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/* A plain `http.get`, because supertest decodes gzip and Brotli before the
   test could see the bytes on the wire. */
const rawGet = async (
  app: Express,
  path: string,
  acceptEncoding: string,
): Promise<RawResponse> => {
  const server = app.listen(0);
  try {
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const res = await new Promise<IncomingMessage>((resolve, reject) => {
      get(
        { port, path, headers: { 'Accept-Encoding': acceptEncoding } },
        resolve,
      ).on('error', reject);
    });
    const chunks: Buffer[] = [];
    for await (const chunk of res) chunks.push(chunk as Buffer);
    return {
      status: res.statusCode ?? 0,
      headers: res.headers,
      body: Buffer.concat(chunks),
    };
  } finally {
    server.close();
  }
};

describe('createResponseCompressionMiddleware', () => {
  it('gzips a large JSON response for a client that accepts gzip', async () => {
    const res = await rawGet(createTestApp(), '/json', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['vary']).toContain('Accept-Encoding');
    const body = res.body;
    expect(body.length).toBeLessThan(JSON.stringify(LARGE_LIST).length / 5);
    expect(JSON.parse(gunzipSync(body).toString('utf-8'))).toEqual(LARGE_LIST);
  });

  it('prefers Brotli when the client accepts it', async () => {
    const res = await rawGet(createTestApp(), '/json', 'gzip, deflate, br');

    expect(res.headers['content-encoding']).toBe('br');
  });

  it('compresses a +json media type', async () => {
    const res = await rawGet(createTestApp(), '/problem-json', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('sends JSON uncompressed to a client that accepts no encoding', async () => {
    const res = await rawGet(createTestApp(), '/json', 'identity');

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(res.body.toString('utf-8'))).toEqual(LARGE_LIST);
  });

  it(`leaves a JSON body under ${RESPONSE_COMPRESSION_THRESHOLD_BYTES} bytes as it is`, async () => {
    const res = await rawGet(createTestApp(), '/small-json', 'gzip');

    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('never compresses an event stream', async () => {
    const res = await rawGet(createTestApp(), '/sse', 'gzip');

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body.toString('utf-8')).toContain('data: ');
  });

  it('leaves non-JSON bodies such as proxied files alone', async () => {
    const res = await rawGet(createTestApp(), '/text', 'gzip');

    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('passes a proxied JSON file through with its Content-Length', async () => {
    const res = await rawGet(createTestApp(), '/proxied-json-file', 'gzip, br');

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['content-length']).toBe(
      String(PROXIED_JSON_FILE.length),
    );
    expect(res.body.equals(PROXIED_JSON_FILE)).toBe(true);
  });

  it('leaves a ranged JSON response alone', async () => {
    const res = await rawGet(createTestApp(), '/ranged-json', 'gzip');

    expect(res.status).toBe(206);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('does not encode a body the handler already encoded', async () => {
    const res = await rawGet(createTestApp(), '/encoded-json', 'gzip, br');

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.equals(PRE_ENCODED_BODY)).toBe(true);
  });
});
