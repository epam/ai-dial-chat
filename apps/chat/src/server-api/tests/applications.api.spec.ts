import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationsApi } from '../api-client';
import {
  createApplication,
  getApplicationResourceDependencies,
  getApplications,
  updateApplicationAccess,
} from '../applications';

describe('getApplications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated ApplicationsApi', async () => {
    const mockResponse = {
      data: [{ id: 'my-app', object: 'application', display_name: 'My App' }],
    };
    const spy = vi
      .spyOn(applicationsApi, 'listApplications')
      .mockResolvedValue(mockResponse);

    const result = await getApplications();

    expect(spy).toHaveBeenCalledOnce();
    expect(result).toEqual(mockResponse);
  });
});

describe('createApplication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always sends a conditional create so an existing app is never overwritten', async () => {
    const spy = vi
      .spyOn(applicationsApi, 'createApplication')
      .mockResolvedValue({ id: 'applications/bucket/My%20App__1.0.0' });

    await createApplication({ name: 'My App', version: '1.0.0' });

    expect(spy).toHaveBeenCalledWith({
      createApplicationBodyDto: {
        name: 'My App',
        version: '1.0.0',
        createOnly: true,
      },
    });
  });
});

describe('getApplicationResourceDependencies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the list of the named application through the generated client', async () => {
    const response = { resourceDependencies: [] };
    const spy = vi
      .spyOn(applicationsApi, 'getApplicationResourceDependencies')
      .mockResolvedValue(response);

    await expect(getApplicationResourceDependencies('my-app')).resolves.toBe(
      response,
    );

    expect(spy).toHaveBeenCalledWith({ applicationName: 'my-app' });
  });
});

describe('updateApplicationAccess', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the given display fields together with the dependency list', async () => {
    const spy = vi
      .spyOn(applicationsApi, 'updateApplication')
      .mockResolvedValue({ id: 'my-app' });
    const list = [
      {
        linkId: 'access-files',
        target: { url: 'files/{current-user}/' },
        access: ['READ' as const],
      },
    ];

    await updateApplicationAccess(
      'my-app',
      { name: 'My App', version: '1.0.0', topics: ['a'] },
      list,
    );

    expect(spy).toHaveBeenCalledWith({
      applicationName: 'my-app',
      updateApplicationBodyDto: {
        name: 'My App',
        version: '1.0.0',
        topics: ['a'],
        resourceDependencies: list,
      },
    });
  });

  it('sends an empty list to clear the stored one', async () => {
    const spy = vi
      .spyOn(applicationsApi, 'updateApplication')
      .mockResolvedValue({ id: 'my-app' });

    await updateApplicationAccess('my-app', { name: 'My App' }, []);

    expect(spy.mock.calls[0][0].updateApplicationBodyDto).toMatchObject({
      resourceDependencies: [],
    });
  });
});
