import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ApplicationSchemasModule } from '../application-schemas/application-schemas.module';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { MetricsInterceptor } from '../common/interceptors/metrics.interceptor';
import { validate } from '../config/validation';
import { ConversationModule } from '../conversations/conversation.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { FilesModule } from '../files/files.module';
import { HealthController } from '../health/health.controller';
import { ModelsModule } from '../models/models.module';
import { RateModule } from '../rate/rate.module';
import { ThemeController } from '../themes/theme.controller';
import { ThemeService } from '../themes/theme.service';
import { UserConfigModule } from '../user-config/user-config.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
    ApplicationSchemasModule,
    ApplicationsModule,
    DeploymentsModule,
    ModelsModule,
    ChatModule,
    ConversationModule,
    UserConfigModule,
    FilesModule,
    RateModule,
  ],
  controllers: [AppController, ThemeController, HealthController],
  providers: [
    AppService,
    ThemeService,
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
