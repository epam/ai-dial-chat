import { Module } from '@nestjs/common';
import { PromptsFolderService } from './folder/prompts-folder.service';
import { PromptsPersonalService } from './personal/prompts-personal.service';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';
import { PromptsPublicService } from './public/prompts-public.service';
import { PromptsResourceService } from './resource/prompts-resource.service';

@Module({
  controllers: [PromptController],
  providers: [
    PromptService,
    PromptsResourceService,
    PromptsPersonalService,
    PromptsPublicService,
    PromptsFolderService,
  ],
})
export class PromptModule {}
