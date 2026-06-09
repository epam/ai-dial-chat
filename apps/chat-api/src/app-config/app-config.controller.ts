import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';
import { AppConfigDto } from './dto/app-config.dto';

@ApiTags('config')
@Controller({ path: 'config', version: '1' })
export class AppConfigController {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get application feature configuration' })
  @ApiResponse({ status: 200, type: AppConfigDto })
  getConfig(): AppConfigDto {
    return {
      asrModelId:
        this.configService.get('ASR_MODEL', { infer: true }) ?? null,
      transcribeSizeLimitBytes:
        this.configService.get('TRANSCRIBE_SIZE_LIMIT_BYTES', {
          infer: true,
        }) ?? 5 * 1024 * 1024,
    };
  }
}
