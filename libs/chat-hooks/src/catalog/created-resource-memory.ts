import type { SavedResource } from './resource-save';

/** What a create in the Save panel made and where. */
export interface CreatedResource {
  /** Full id of the created resource. */
  id: string;
  /** The Personal folder it was created in, as a `/`-joined path. */
  folderKey: string;
}

/**
 * Remembers the resource an earlier Save panel attempt created, so a retry in
 * the same folder reuses it instead of creating another one. The host decides
 * when to forget it.
 */
export class CreatedResourceMemory {
  private created: CreatedResource | undefined;

  /** Returns the remembered resource, if any. */
  get(): CreatedResource | undefined {
    return this.created;
  }

  /**
   * Remembers `resource`, replacing any earlier one.
   * @param resource - the resource a create just made
   */
  remember(resource: CreatedResource): void {
    this.created = resource;
  }

  /** Forgets the remembered resource and returns it, if there was one. */
  take(): CreatedResource | undefined {
    const created = this.created;
    this.created = undefined;
    return created;
  }
}

/** Parameters for {@link createReusingCreateIn}. */
export interface ReusingCreateInParams {
  /** What the earlier attempts created. */
  memory: CreatedResourceMemory;
  /** Creates the resource in `folderPath`; it must answer the created id. */
  create: (folderPath: string[]) => Promise<{ id?: string } | void>;
  /** Runs after every create or reuse with the resource's id, before the panel publishes or copies anything. A rejection aborts the save and the resource stays remembered. Absent means nothing runs. */
  afterCreate?: (id: string) => Promise<void>;
}

/**
 * Returns the `createIn` of a create adapter that creates once per folder: a
 * retry in the folder `memory` already holds reuses that resource and only
 * runs `afterCreate` again, while another folder creates a new one.
 */
export const createReusingCreateIn =
  ({
    memory,
    create,
    afterCreate,
  }: ReusingCreateInParams): ((
    folderPath: string[],
  ) => Promise<SavedResource>) =>
  async (folderPath) => {
    const folderKey = folderPath.join('/');
    let created = memory.get();
    if (created?.folderKey !== folderKey) {
      const result = await create(folderPath);
      if (!result?.id) throw new Error('Created resource has no id');
      created = { id: result.id, folderKey };
      memory.remember(created);
    }
    await afterCreate?.(created.id);
    return { id: created.id };
  };
