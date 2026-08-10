import { Injectable } from '@nestjs/common';
import { PromptsFolderService } from './folder/prompts-folder.service';
import { PromptsPersonalService } from './personal/prompts-personal.service';
import { PromptsPublicService } from './public/prompts-public.service';

/*
 * Thin orchestrator for PromptController. Every method here delegates to
 * exactly one of the three focused services below — see
 * openspec/changes/split-prompt-service/design.md for the ownership map and
 * why the split follows this boundary. A fourth service, PromptsResourceService
 * (shared low-level DIAL Core resource I/O), sits beneath these three and is
 * not injected directly here — it has no controller-facing methods of its own.
 */
@Injectable()
export class PromptService {
  constructor(
    private readonly personalService: PromptsPersonalService,
    private readonly publicService: PromptsPublicService,
    private readonly folderService: PromptsFolderService,
  ) {}

  // Personal
  listPrompts = this.personalService.listPrompts.bind(this.personalService);
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
