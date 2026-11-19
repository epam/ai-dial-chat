import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from 'http';
import type { AddressInfo } from 'net';

/** One request the fake DIAL Analytics server received. */
export interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

/** What the fake answers. `hang` never answers, to exercise the timeout. */
export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  hang?: boolean;
}

export type FakeHandler = (
  request: RecordedRequest,
) => FakeResponse | Promise<FakeResponse>;

export interface FakeAnalyticsServer {
  url: string;
  requests: RecordedRequest[];
  setHandler: (handler: FakeHandler) => void;
  close: () => Promise<void>;
}

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * A real HTTP server on 127.0.0.1 standing in for DIAL Analytics, so tests
 * mock ADAS at the HTTP boundary and exercise the transport, queries and
 * mapper for real.
 */
export const startFakeAnalytics = async (
  initialHandler: FakeHandler = () => ({ status: 404 }),
): Promise<FakeAnalyticsServer> => {
  let handler = initialHandler;
  const requests: RecordedRequest[] = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const recorded: RecordedRequest = {
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        headers: req.headers,
        body: await readBody(req),
      };
      requests.push(recorded);
      const response = await handler(recorded);
      if (response.hang) return;
      res.statusCode = response.status ?? 200;
      res.setHeader('Content-Type', 'application/json');
      for (const [name, value] of Object.entries(response.headers ?? {})) {
        res.setHeader(name, value);
      }
      res.end(response.body === undefined ? '' : JSON.stringify(response.body));
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    setHandler: (next) => {
      handler = next;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
};
