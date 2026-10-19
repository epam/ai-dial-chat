import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationsApi } from '../api-client';
import { createApplication, getApplications } from '../applications';

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
