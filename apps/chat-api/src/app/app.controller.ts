import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('apps')
@Controller('apps')
export class AppController {
  constructor(private readonly appService: AppService) {}
}
