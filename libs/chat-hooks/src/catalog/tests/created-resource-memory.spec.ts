import { describe, expect, it, vi } from 'vitest';
import {
  CreatedResourceMemory,
  createReusingCreateIn,
} from '../created-resource-memory';

describe('CreatedResourceMemory', () => {
  it('remembers a resource and forgets it when taken', () => {
    const memory = new CreatedResourceMemory();
    expect(memory.get()).toBeUndefined();

    memory.remember({ id: 'a', folderKey: 'F' });

    expect(memory.get()).toEqual({ id: 'a', folderKey: 'F' });
    expect(memory.take()).toEqual({ id: 'a', folderKey: 'F' });
    expect(memory.get()).toBeUndefined();
    expect(memory.take()).toBeUndefined();
  });
});

describe('createReusingCreateIn', () => {
  const setup = () => {
    const memory = new CreatedResourceMemory();
    const create = vi.fn().mockResolvedValue({ id: 'applications/b/new' });
    const afterCreate = vi.fn().mockResolvedValue(undefined);
    const createIn = createReusingCreateIn({ memory, create, afterCreate });
    return { memory, create, afterCreate, createIn };
  };

  it('creates, remembers, runs the follow-up and answers the id', async () => {
    const { memory, create, afterCreate, createIn } = setup();

    await expect(createIn(['A', 'B'])).resolves.toEqual({
      id: 'applications/b/new',
    });

    expect(create).toHaveBeenCalledWith(['A', 'B']);
    expect(afterCreate).toHaveBeenCalledWith('applications/b/new');
    expect(memory.get()).toEqual({
      id: 'applications/b/new',
      folderKey: 'A/B',
    });
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      afterCreate.mock.invocationCallOrder[0],
    );
  });

  it('reuses the remembered resource for a retry in the same folder and runs the follow-up again', async () => {
    const { create, afterCreate, createIn } = setup();
    afterCreate.mockRejectedValueOnce(new Error('refused'));
    await expect(createIn(['A'])).rejects.toThrow('refused');

    await expect(createIn(['A'])).resolves.toEqual({
      id: 'applications/b/new',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(afterCreate).toHaveBeenCalledTimes(2);
  });

  it('creates again in another folder', async () => {
    const { create, createIn } = setup();
    await createIn(['A']);

    await createIn(['B']);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('creates again once the memory was cleared', async () => {
    const { memory, create, createIn } = setup();
    await createIn(['A']);
    memory.take();

    await createIn(['A']);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('rejects a create that answers no id and remembers nothing', async () => {
    const { memory, create, createIn } = setup();
    create.mockResolvedValue({});

    await expect(createIn([])).rejects.toThrow('no id');
    expect(memory.get()).toBeUndefined();
  });

  it('works without a follow-up', async () => {
    const memory = new CreatedResourceMemory();
    const createIn = createReusingCreateIn({
      memory,
      create: vi.fn().mockResolvedValue({ id: 'x' }),
    });

    await expect(createIn([])).resolves.toEqual({ id: 'x' });
  });
});
