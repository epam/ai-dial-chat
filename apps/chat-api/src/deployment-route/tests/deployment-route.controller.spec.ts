import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialClientService } from '../../dial/dial-client.service';
import { DeploymentRouteController } from '../deployment-route.controller';

const CORE_URL = 'http://core.test';
const DEPLOYMENT_ID = 'applications/public/demo-service__1.0.0';
const ENCODED_ID = encodeURIComponent(DEPLOYMENT_ID);
const ROUTE_BASE = `/api/v1/deployment-route/${ENCODED_ID}`;
const CORE_ROUTE_BASE = `${CORE_URL}/v1/deployments/${DEPLOYMENT_ID}/route`;

/** Stands in for the session guard: the real one sets `req.user` the same way. */
class FakeSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = { at: 'access-token' };
    return true;
  }
}

describe('DeploymentRouteController', () => {
  let app: INestApplication;
  let fetchCore: ReturnType<typeof vi.fn>;

  const coreAnswers = (body: unknown, status = 200) =>
    fetchCore.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  beforeEach(async () => {
    fetchCore = vi.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [DeploymentRouteController],
      providers: [
        {
          provide: DialClientService,
          useValue: { baseUrl: `${CORE_URL}/`, fetchCore },
        },
        { provide: APP_GUARD, useClass: FakeSessionGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("forwards a GET to the deployment's Core route with the caller's own token", async () => {
    coreAnswers({ state: 'ready' });

    const res = await request(app.getHttpServer()).get(
      `${ROUTE_BASE}/v1/items/ITEM1`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'ready' });
    const [url, init] = fetchCore.mock.calls[0];
    expect(url).toBe(`${CORE_ROUTE_BASE}/v1/items/ITEM1`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer access-token');
    expect(init.body).toBeUndefined();
  });

  it('keeps the slashes of a deployment ID sent as one encoded segment', async () => {
    coreAnswers({});

    await request(app.getHttpServer()).get(`${ROUTE_BASE}/a`);

    expect(fetchCore.mock.calls[0][0]).toBe(`${CORE_ROUTE_BASE}/a`);
  });

  it('forwards the query string and a JSON body', async () => {
    coreAnswers({ id: 'ITEM1' }, 202);

    const res = await request(app.getHttpServer())
      .post(`${ROUTE_BASE}/v1/items?dryRun=true`)
      .send({ name: 'n1', note: 'hello' });

    expect(res.status).toBe(202);
    const [url, init] = fetchCore.mock.calls[0];
    expect(url).toBe(`${CORE_ROUTE_BASE}/v1/items?dryRun=true`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      name: 'n1',
      note: 'hello',
    });
  });

  it.each(['PUT', 'DELETE'] as const)('forwards a %s', async (method) => {
    coreAnswers({ ok: true });

    const call = request(app.getHttpServer());
    const res = await (method === 'PUT' ? call.put : call.delete)
      .call(call, `${ROUTE_BASE}/v1/things/1`)
      .send();

    expect(res.status).toBe(200);
    expect(fetchCore.mock.calls[0][1].method).toBe(method);
  });

  it("relays the upstream's error status and body unchanged", async () => {
    const issues = [{ field: 'name', problem: 'too long' }];
    coreAnswers(
      { error: 'validation_failed', detail: 'Invalid value', issues },
      422,
    );

    const res = await request(app.getHttpServer())
      .post(`${ROUTE_BASE}/v1/items`)
      .send({ name: 'n1' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'validation_failed',
      detail: 'Invalid value',
      issues,
    });
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects a path or deployment ID with a dot segment before calling Core', async () => {
    /* A raw request: HTTP clients normalise `..` away before it reaches the server. */
    const { port } = app.getHttpServer().listen(0).address() as AddressInfo;
    const rawGet = (path: string): Promise<number> =>
      new Promise((resolve, reject) => {
        http
          .get({ host: '127.0.0.1', port, path }, (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          })
          .on('error', reject);
      });

    const withDotPath = await rawGet(`${ROUTE_BASE}/v1/%2E%2E/admin`);
    const withDotId = await rawGet(
      `/api/v1/deployment-route/${encodeURIComponent('a/../b')}/v1/x`,
    );

    expect(withDotPath).toBe(400);
    expect(withDotId).toBe(400);
    expect(fetchCore).not.toHaveBeenCalled();
  });

  it('rejects methods other than GET, POST, PUT and DELETE', async () => {
    const res = await request(app.getHttpServer()).patch(`${ROUTE_BASE}/v1/x`);

    expect(res.status).toBe(405);
    expect(fetchCore).not.toHaveBeenCalled();
  });

  it('answers 503 when Core cannot be reached', async () => {
    fetchCore.mockRejectedValue(new TypeError('fetch failed'));

    const res = await request(app.getHttpServer()).get(`${ROUTE_BASE}/v1/x`);

    expect(res.status).toBe(503);
  });

  it('answers 504 when Core exceeds the deadline', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    fetchCore.mockRejectedValue(timeout);

    const res = await request(app.getHttpServer()).get(`${ROUTE_BASE}/v1/x`);

    expect(res.status).toBe(504);
  });
});
