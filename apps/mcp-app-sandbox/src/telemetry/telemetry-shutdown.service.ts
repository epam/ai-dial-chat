import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { shutdownOpenTelemetry } from './otel-sdk';

@Injectable()
export class TelemetryShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownOpenTelemetry();
  }
}
