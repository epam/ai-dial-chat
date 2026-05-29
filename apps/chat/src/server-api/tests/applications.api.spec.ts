import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationsApi } from '../api-client';
import { getApplications } from '../applications';

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
