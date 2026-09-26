import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { TextRefinementController } from './text-refinement.controller';
import { TextRefinementService } from './text-refinement.service';

@Module({
  imports: [AppConfigModule],
  controllers: [TextRefinementController],
  providers: [TextRefinementService],
})
export class TextRefinementModule {}
