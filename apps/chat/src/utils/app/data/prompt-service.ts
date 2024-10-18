import { Observable } from 'rxjs';

import { constructPath } from '@/src/utils/app/file';
import { getPromptRootId, isRootPromptId } from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';

import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';

import { prepareEntityName } from '../common';
import { getPathToFolderById } from '../folders';
import { DataService } from './data-service';

export class PromptService {
  public static getPromptsFolders(): Observable<FolderInterface[]> {
    return DataService.getDataStorage().getPromptsFolders();
  }

  public static setPromptFolders(folders: FolderInterface[]): Observable<void> {
    return DataService.getDataStorage().setPromptsFolders(folders);
  }

  public static getPrompts(
    path?: string,
    recursive?: boolean,
  ): Observable<PromptInfo[]> {
    return DataService.getDataStorage().getPrompts(path, recursive);
  }

  public static getMultipleFoldersPrompts(
    paths: string[],
    recursive?: boolean,
  ): Observable<PromptInfo[]> {
    return DataService.getDataStorage().getMultipleFoldersPrompts(
      paths,
      recursive,
    );
  }

  public static getPromptsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<PromptInfo>> {
    return DataService.getDataStorage().getPromptsAndFolders(path);
  }

  public static getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return DataService.getDataStorage().getPrompt(info);
  }

  public static setPrompts(prompts: Prompt[]): Observable<PromptInfo> {
    return DataService.getDataStorage().setPrompts(prompts);
  }

  public static createPrompt(prompt: Prompt): Observable<PromptInfo | null> {
    return DataService.getDataStorage().createPrompt(prompt);
  }

  public static updatePrompt(prompt: Prompt): Observable<void> {
    return DataService.getDataStorage().updatePrompt(prompt);
  }

  public static deletePrompt(info: PromptInfo): Observable<void> {
    return DataService.getDataStorage().deletePrompt(info);
  }
}

export const getPreparedPrompts = ({
  prompts,
  folders,
}: {
  prompts: Prompt[];
  folders: FolderInterface[];
}) =>
  prompts.map((prompt) => {
    const { path } = getPathToFolderById(folders, prompt.folderId, {
      prepareNames: true,
      forRenaming: true,
      replaceWithSpacesForRenaming: true,
      trimEndDotsRequired: true,
    });
    const newName = prepareEntityName(prompt.name, {
      forRenaming: true,
      replaceWithSpacesForRenaming: true,
      trimEndDotsRequired: true,
    });

    const folderId = isRootPromptId(path)
      ? path
      : constructPath(getPromptRootId(), path);

    return regeneratePromptId({
      ...prompt,
      name: newName,
      folderId,
    });
  }); // to send prompts with proper parentPath

export const getImportPreparedPrompts = ({
  prompts,
  folders,
}: {
  prompts: Prompt[];
  folders: FolderInterface[];
}) =>
  prompts.map((prompt) => {
    const { path } = getPathToFolderById(folders, prompt.folderId, {
      forRenaming: false,
      trimEndDotsRequired: true,
      prepareNames: true,
    });
    const newName = prepareEntityName(prompt.name);

    const folderId = isRootPromptId(path)
      ? path
      : constructPath(getPromptRootId(), path);
    const promptId = constructPath(folderId, newName);

    return {
      ...prompt,
      id: promptId,
      name: newName,
      folderId: folderId,
    };
  }); // to send prompts with proper parentPath
