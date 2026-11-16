import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ResourceDependenciesResultDto,
  ResourceDependencyType,
} from '../../dto/resource-dependency.dto';

const validateResult = async (plain: Record<string, unknown>) =>
  validate(plainToInstance(ResourceDependenciesResultDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ResourceDependenciesResultDto', () => {
  it('accepts a list with versioned and unversioned dependencies', async () => {
    const errors = await validateResult({
      dependencies: [
        {
          id: 'prompts/b/Greeting',
          name: 'Greeting',
          type: ResourceDependencyType.Prompt,
          location: '',
        },
        {
          id: 'toolsets/b/Search__1.0.0',
          name: 'Search',
          version: '1.0.0',
          type: ResourceDependencyType.Toolset,
          location: 'Team',
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty list', async () => {
    expect(await validateResult({ dependencies: [] })).toHaveLength(0);
  });

  it('rejects a dependency whose type is not a known kind', async () => {
    const errors = await validateResult({
      dependencies: [{ id: 'x/b/y', name: 'y', type: 'model', location: '' }],
    });
    expect(errors).not.toHaveLength(0);
  });
});
