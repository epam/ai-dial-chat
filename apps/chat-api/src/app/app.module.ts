import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from '../app-config/app-config.module';
import { ApplicationSchemasModule } from '../application-schemas/application-schemas.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { validate } from '../config/validation';
import { ConversationModule } from '../conversations/conversation.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { DialCoreModule } from '../dial/dial-core.module';
import { FilesModule } from '../files/files.module';
import { HealthController } from '../health/health.controller';
import { ModelsModule } from '../models/models.module';
import { RateModule } from '../rate/rate.module';
import { ThemesModule } from '../themes/themes.module';
import { ToolsetsModule } from '../toolsets/toolsets.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { AppController } from './app.controller';
import { createServeStaticOptions } from './static-assets';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000, // 5 minutes in milliseconds
      max: 100, // Maximum number of items in cache
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
    ServeStaticModule.forRoot(createServeStaticOptions()),
    DialCoreModule,
    AppConfigModule,
    ApplicationSchemasModule,
    ApplicationsModule,
    DeploymentsModule,
    ModelsModule,
    ToolsetsModule,
    ChatModule,
    ConversationModule,
    UserConfigModule,
    FilesModule,
    RateModule,
    TranscriptionModule,
    ThemesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
