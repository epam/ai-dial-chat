import { Injectable, Logger } from '@nestjs/common';
import type { PromptListResponseDto } from './dto/prompt-list-response.dto';
import { PromptsFolderService } from './folder/prompts-folder.service';
import { PromptsPersonalService } from './personal/prompts-personal.service';
import { PromptsPublicService } from './public/prompts-public.service';

/*
 * Thin orchestrator for PromptController. Every method here delegates to
 * exactly one of the three focused services below — see
 * openspec/changes/archive/2026-08-10-split-prompt-service/design.md for the ownership map and
 * why the split follows this boundary. A fourth service, PromptsResourceService
 * (shared low-level DIAL Core resource I/O), sits beneath these three and is
 * not injected directly here — it has no controller-facing methods of its own.
 */
@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  constructor(
    private readonly personalService: PromptsPersonalService,
    private readonly publicService: PromptsPublicService,
    private readonly folderService: PromptsFolderService,
  ) {}

  // Personal
  async listPrompts(
    token: string,
    bucket: string,
  ): Promise<PromptListResponseDto> {
    const [personalResult, organisationResult] = await Promise.allSettled([
      this.personalService.listPrompts(token, bucket),
      this.publicService.listPublicPrompts(token),
    ]);
    if (
      personalResult.status === 'rejected' &&
      organisationResult.status === 'rejected'
    ) {
      throw personalResult.reason;
    }
    if (personalResult.status === 'rejected') {
      this.logger.warn('Personal prompt catalog listing failed');
    }
    if (organisationResult.status === 'rejected') {
      this.logger.warn('Public prompt catalog listing failed');
    }

    const personal =
      personalResult.status === 'fulfilled'
        ? personalResult.value
        : { prompts: [], folders: [], sharedWithMe: [] };
    const organisation =
      organisationResult.status === 'fulfilled'
        ? organisationResult.value
        : { prompts: [], folders: [] };
    return {
      ...personal,
      publicPrompts: organisation.prompts,
      publicFolders: organisation.folders,
    };
  }
  getSharedPrompts = this.personalService.getSharedPrompts.bind(
    this.personalService,
  );
  getPrompt = this.personalService.getPrompt.bind(this.personalService);
  createPrompt = this.personalService.createPrompt.bind(this.personalService);
  updatePrompt = this.personalService.updatePrompt.bind(this.personalService);
  deletePrompt = this.personalService.deletePrompt.bind(this.personalService);

  // Public
  listPublicPrompts = this.publicService.listPublicPrompts.bind(
    this.publicService,
  );
  getPublicPrompt = this.publicService.getPublicPrompt.bind(this.publicService);

  // Folder
  createFolder = this.folderService.createFolder.bind(this.folderService);
  renameFolder = this.folderService.renameFolder.bind(this.folderService);
  deleteFolder = this.folderService.deleteFolder.bind(this.folderService);
  movePrompt = this.folderService.movePrompt.bind(this.folderService);
}
