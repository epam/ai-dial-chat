import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationsApi } from '../api-client';
import {
  getApplicationSchema,
  getApplicationSchemas,
} from '../application-schemas';

describe('application-schemas server-api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getApplicationSchemas', () => {
    it('delegates to the generated listApplicationSchemas method', async () => {
      const mockResponse = {
        schemas: [{ id: 'quick-app', displayName: 'Quick App' }],
      };
      const spy = vi
        .spyOn(applicationsApi, 'listApplicationSchemas')
        .mockResolvedValue(mockResponse);

      const result = await getApplicationSchemas();

      expect(spy).toHaveBeenCalledOnce();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getApplicationSchema', () => {
    it('delegates to the generated getApplicationSchema method with the given id', async () => {
      const mockResponse = {
        $id: 'schema-123',
        title: 'Quick App',
      };
      const spy = vi
        .spyOn(applicationsApi, 'getApplicationSchema')
        .mockResolvedValue(mockResponse);

      const result = await getApplicationSchema('schema-123');

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith({ id: 'schema-123' });
      expect(result).toEqual(mockResponse);
    });
  });
});
