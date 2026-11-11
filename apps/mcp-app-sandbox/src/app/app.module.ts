import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../config/validation';
import { TelemetryShutdownService } from '../telemetry/telemetry-shutdown.service';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),
  ],
  controllers: [SandboxController],
  providers: [SandboxService, TelemetryShutdownService],
})
export class AppModule {}
