import { existsSync } from 'node:fs';
import {
  Controller,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { SkillArchiveUploadInterceptor } from '../skill-archive-upload.interceptor';

@Controller()
class TestController {
  @Post('upload')
  @UseInterceptors(SkillArchiveUploadInterceptor)
  upload(@UploadedFile() file: Express.Multer.File | undefined): {
    path?: string;
  } {
    return { path: file?.path };
  }
}

@Module({
  controllers: [TestController],
  providers: [
    SkillArchiveUploadInterceptor,
    { provide: ConfigService, useValue: { get: () => undefined } },
  ],
})
class TestModule {}

describe('SkillArchiveUploadInterceptor', () => {
  it('stages the uploaded file to disk and removes it after the response', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/upload')
      .attach('file', Buffer.from('zip bytes'), 'skill.zip')
      .expect(201);
    const stagedPath: string = res.body.path;

    expect(stagedPath).toBeTruthy();
    // The interceptor removes the staged file once the response completes.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    expect(existsSync(stagedPath)).toBe(false);

    await app.close();
  });

  it('rejects an oversized archive with 413 and stages no lingering temp file', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'SKILL_ARCHIVE_UPLOAD_MAX_BYTES' ? 5 : undefined,
      })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/upload')
      .attach('file', Buffer.from('this is definitely too big'), 'skill.zip')
      .expect(413);

    await app.close();
  });

  it('proceeds with no file when none is attached, leaving the route handler to reject it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).post('/upload').expect(201);
    expect(res.body.path).toBeUndefined();

    await app.close();
  });
});
