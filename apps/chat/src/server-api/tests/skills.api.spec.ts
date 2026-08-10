import type {
  SkillFileDeleteResponseDto,
  SkillFileListResponseDto,
  SkillFileUploadResponseDto,
  SkillGroupingFolderResponseDto,
  SkillListResponseDto,
  SkillOperationResultDto,
  SkillUploadResponseDto,
} from '@epam/chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skillsApi } from '../api-client';
import {
  createSkillGroupingFolder,
  deleteSkill,
  deleteSkillFile,
  deleteSkillGroupingFolder,
  downloadSkill,
  downloadSkillFile,
  listSkillFiles,
  listSkills,
  uploadSkill,
  uploadSkillFile,
} from '../skills.api';

const MOCK_LIST_RESPONSE: SkillListResponseDto = {
  bucket: 'my-bucket',
  path: '',
  items: [],
};

describe('listSkills', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with correct params', async () => {
    const spy = vi
      .spyOn(skillsApi, 'listSkills')
      .mockResolvedValue(MOCK_LIST_RESPONSE);

    const result = await listSkills({ bucket: 'my-bucket' });

    expect(spy).toHaveBeenCalledWith({ bucket: 'my-bucket' }, undefined);
    expect(result).toEqual(MOCK_LIST_RESPONSE);
  });

  it('passes optional params through to the generated client', async () => {
    const spy = vi
      .spyOn(skillsApi, 'listSkills')
      .mockResolvedValue(MOCK_LIST_RESPONSE);

    await listSkills({
      bucket: 'my-bucket',
      path: 'grouping-folder/',
      token: 'next-token',
      limit: 10,
      recursive: true,
    });

    expect(spy).toHaveBeenCalledWith(
      {
        bucket: 'my-bucket',
        path: 'grouping-folder/',
        token: 'next-token',
        limit: 10,
        recursive: true,
      },
      undefined,
    );
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const spy = vi
      .spyOn(skillsApi, 'listSkills')
      .mockResolvedValue(MOCK_LIST_RESPONSE);
    const controller = new AbortController();

    await listSkills({ bucket: 'my-bucket' }, controller.signal);

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket' },
      { signal: controller.signal },
    );
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 401 });
    vi.spyOn(skillsApi, 'listSkills').mockRejectedValue(error);

    await expect(listSkills({ bucket: 'my-bucket' })).rejects.toBe(error);
  });
});

const MOCK_FILE_LIST_RESPONSE: SkillFileListResponseDto = {
  bucket: 'my-bucket',
  path: 'my-skill/',
  items: [],
};

describe('listSkillFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with correct params', async () => {
    const spy = vi
      .spyOn(skillsApi, 'listSkillFiles')
      .mockResolvedValue(MOCK_FILE_LIST_RESPONSE);

    const result = await listSkillFiles({
      bucket: 'my-bucket',
      filePath: 'my-skill/',
    });

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', filePath: 'my-skill/' },
      undefined,
    );
    expect(result).toEqual(MOCK_FILE_LIST_RESPONSE);
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 404 });
    vi.spyOn(skillsApi, 'listSkillFiles').mockRejectedValue(error);

    await expect(
      listSkillFiles({ bucket: 'my-bucket', filePath: 'missing-skill/' }),
    ).rejects.toBe(error);
  });
});

describe('downloadSkill', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to downloadSkillRaw and returns the raw Response', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(skillsApi, 'downloadSkillRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);

    const result = await downloadSkill('my-bucket', 'my-skill/');

    expect(skillsApi.downloadSkillRaw).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'my-skill/',
    });
    expect(result).toBe(rawResponse);
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(skillsApi, 'downloadSkillRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);
    const controller = new AbortController();

    await downloadSkill('my-bucket', 'my-skill/', controller.signal);

    expect(skillsApi.downloadSkillRaw).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'my-skill/' },
      { signal: controller.signal },
    );
  });
});

describe('downloadSkillFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to downloadSkillFileRaw and returns the raw Response', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(skillsApi, 'downloadSkillFileRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);

    const result = await downloadSkillFile(
      'my-bucket',
      'my-skill/',
      'SKILL.md',
    );

    expect(skillsApi.downloadSkillFileRaw).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'my-skill/',
      filePath: 'SKILL.md',
    });
    expect(result).toBe(rawResponse);
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(skillsApi, 'downloadSkillFileRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);
    const controller = new AbortController();

    await downloadSkillFile(
      'my-bucket',
      'my-skill/',
      'SKILL.md',
      controller.signal,
    );

    expect(skillsApi.downloadSkillFileRaw).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'my-skill/', filePath: 'SKILL.md' },
      { signal: controller.signal },
    );
  });
});

const MOCK_UPLOAD_RESPONSE: SkillUploadResponseDto = { etag: '"abc123"' };

describe('uploadSkill', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with the file and returns the ETag', async () => {
    const spy = vi
      .spyOn(skillsApi, 'uploadSkill')
      .mockResolvedValue(MOCK_UPLOAD_RESPONSE);
    const file = new Blob(['zip-bytes']);

    const result = await uploadSkill('my-bucket', 'my-skill/', file);

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'my-skill/', file, ifMatch: undefined },
      undefined,
    );
    expect(result).toEqual(MOCK_UPLOAD_RESPONSE);
  });

  it('forwards ifMatch and an AbortSignal when provided', async () => {
    const spy = vi
      .spyOn(skillsApi, 'uploadSkill')
      .mockResolvedValue(MOCK_UPLOAD_RESPONSE);
    const file = new Blob(['zip-bytes']);
    const controller = new AbortController();

    await uploadSkill(
      'my-bucket',
      'my-skill/',
      file,
      '"prev-etag"',
      controller.signal,
    );

    expect(spy).toHaveBeenCalledWith(
      {
        bucket: 'my-bucket',
        path: 'my-skill/',
        file,
        ifMatch: '"prev-etag"',
      },
      { signal: controller.signal },
    );
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 400 });
    vi.spyOn(skillsApi, 'uploadSkill').mockRejectedValue(error);

    await expect(
      uploadSkill('my-bucket', 'my-skill/', new Blob(['zip-bytes'])),
    ).rejects.toBe(error);
  });
});

const MOCK_FILE_UPLOAD_RESPONSE: SkillFileUploadResponseDto = {
  etag: '"def456"',
};

describe('uploadSkillFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with the file and returns the ETag', async () => {
    const spy = vi
      .spyOn(skillsApi, 'uploadSkillFile')
      .mockResolvedValue(MOCK_FILE_UPLOAD_RESPONSE);
    const file = new Blob(['print(1)']);

    const result = await uploadSkillFile(
      'my-bucket',
      'my-skill/',
      'scripts/helper.py',
      file,
    );

    expect(spy).toHaveBeenCalledWith(
      {
        bucket: 'my-bucket',
        path: 'my-skill/',
        filePath: 'scripts/helper.py',
        file,
        ifMatch: undefined,
      },
      undefined,
    );
    expect(result).toEqual(MOCK_FILE_UPLOAD_RESPONSE);
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 404 });
    vi.spyOn(skillsApi, 'uploadSkillFile').mockRejectedValue(error);

    await expect(
      uploadSkillFile(
        'my-bucket',
        'my-skill/',
        'scripts/helper.py',
        new Blob(['print(1)']),
      ),
    ).rejects.toBe(error);
  });
});

const MOCK_OPERATION_RESULT: SkillOperationResultDto = { success: true };

describe('deleteSkill', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with the bucket, path, and ifMatch', async () => {
    const spy = vi
      .spyOn(skillsApi, 'deleteSkill')
      .mockResolvedValue(MOCK_OPERATION_RESULT);

    const result = await deleteSkill('my-bucket', 'my-skill/', '"etag"');

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'my-skill/', ifMatch: '"etag"' },
      undefined,
    );
    expect(result).toEqual(MOCK_OPERATION_RESULT);
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 404 });
    vi.spyOn(skillsApi, 'deleteSkill').mockRejectedValue(error);

    await expect(deleteSkill('my-bucket', 'my-skill/')).rejects.toBe(error);
  });
});

const MOCK_FILE_DELETE_RESPONSE: SkillFileDeleteResponseDto = {
  etag: '"new-etag"',
};

describe('deleteSkillFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi and returns the new ETag', async () => {
    const spy = vi
      .spyOn(skillsApi, 'deleteSkillFile')
      .mockResolvedValue(MOCK_FILE_DELETE_RESPONSE);

    const result = await deleteSkillFile(
      'my-bucket',
      'my-skill/',
      'scripts/helper.py',
    );

    expect(spy).toHaveBeenCalledWith(
      {
        bucket: 'my-bucket',
        path: 'my-skill/',
        filePath: 'scripts/helper.py',
        ifMatch: undefined,
      },
      undefined,
    );
    expect(result).toEqual(MOCK_FILE_DELETE_RESPONSE);
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 400 });
    vi.spyOn(skillsApi, 'deleteSkillFile').mockRejectedValue(error);

    await expect(
      deleteSkillFile('my-bucket', 'my-skill/', 'SKILL.md'),
    ).rejects.toBe(error);
  });
});

const MOCK_GROUPING_FOLDER_RESPONSE: SkillGroupingFolderResponseDto = {
  etag: '"folder-etag"',
};

describe('createSkillGroupingFolder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi and returns the ETag', async () => {
    const spy = vi
      .spyOn(skillsApi, 'createSkillGroupingFolder')
      .mockResolvedValue(MOCK_GROUPING_FOLDER_RESPONSE);

    const result = await createSkillGroupingFolder('my-bucket', 'team-a/');

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'team-a/' },
      undefined,
    );
    expect(result).toEqual(MOCK_GROUPING_FOLDER_RESPONSE);
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 400 });
    vi.spyOn(skillsApi, 'createSkillGroupingFolder').mockRejectedValue(error);

    await expect(
      createSkillGroupingFolder('my-bucket', 'team-a/'),
    ).rejects.toBe(error);
  });
});

describe('deleteSkillGroupingFolder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated SkillsApi with the bucket, path, and ifMatch', async () => {
    const spy = vi
      .spyOn(skillsApi, 'deleteSkillGroupingFolder')
      .mockResolvedValue(MOCK_OPERATION_RESULT);

    const result = await deleteSkillGroupingFolder(
      'my-bucket',
      'team-a/',
      '"etag"',
    );

    expect(spy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'team-a/', ifMatch: '"etag"' },
      undefined,
    );
    expect(result).toEqual(MOCK_OPERATION_RESULT);
  });

  it('propagates rejection from the generated client on a non-empty-folder conflict', async () => {
    const error = new Response(null, { status: 409 });
    vi.spyOn(skillsApi, 'deleteSkillGroupingFolder').mockRejectedValue(error);

    await expect(
      deleteSkillGroupingFolder('my-bucket', 'team-a/'),
    ).rejects.toBe(error);
  });
});
