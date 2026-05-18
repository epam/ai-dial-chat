import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('apps')
@Controller('apps')
export class AppController {}
