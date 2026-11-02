import {
  Controller,
  Module,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { PROJECT_CONTEXT_MAX_FILES } from '../constants/project-context.constants';
import { ProjectContextUploadInterceptor } from '../project-context-upload.interceptor';

@Controller()
class TestController {
  @Post('upload')
  @UseInterceptors(ProjectContextUploadInterceptor)
  upload(@UploadedFiles() files: Express.Multer.File[] | undefined): {
    sizes: number[];
  } {
    return { sizes: (files ?? []).map((file) => file.buffer.length) };
  }
}

@Module({
  controllers: [TestController],
  providers: [
    ProjectContextUploadInterceptor,
    {
      provide: ConfigService,
      useValue: {
        get: (key: string) =>
          key === 'PROJECT_CONTEXT_FILE_MAX_BYTES' ? 8 : undefined,
      },
    },
  ],
})
class TestModule {}

describe('ProjectContextUploadInterceptor', () => {
  let app: INestApplication;

  const createApp = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    return app;
  };

  afterEach(async () => {
    await app?.close();
  });

  it('reads every files part into memory', async () => {
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/upload')
      .attach('files', Buffer.from('a,b'), 'a.csv')
      .attach('files', Buffer.from('12345678'), 'b.csv')
      .expect(201);

    expect(res.body).toEqual({ sizes: [3, 8] });
  });

  it('proceeds with no files for a name-only request', async () => {
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/upload')
      .field('name', 'Handbook')
      .expect(201);

    expect(res.body).toEqual({ sizes: [] });
  });

  it('rejects a part over the per-file limit with a typed 413', async () => {
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/upload')
      .attach('files', Buffer.from('123456789'), 'big.csv')
      .expect(413);

    expect(res.body).toMatchObject({
      statusCode: 413,
      code: 'file-too-large',
    });
  });

  it('rejects more parts than the count limit with a typed 400', async () => {
    await createApp();

    let req = request(app.getHttpServer()).post('/upload');
    for (let i = 0; i <= PROJECT_CONTEXT_MAX_FILES; i += 1) {
      req = req.attach('files', Buffer.from('x'), `f${i}.csv`);
    }
    const res = await req.expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      code: 'too-many-files',
    });
  });

  it('rejects a file sent under another field name', async () => {
    await createApp();

    const res = await request(app.getHttpServer())
      .post('/upload')
      .attach('other', Buffer.from('x'), 'x.csv')
      .expect(400);

    expect(res.body.code).toBeUndefined();
  });
});
