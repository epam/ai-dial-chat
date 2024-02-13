import { Observable } from 'rxjs';

import { constructPath, notAllowedSymbolsRegex } from '@/src/utils/app/file';

import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';

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

  public static getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return DataService.getDataStorage().getPrompt(info);
  }

  public static setPrompts(prompts: Prompt[]): Observable<void> {
    return DataService.getDataStorage().setPrompts(prompts);
  }

  public static createPrompt(prompt: Prompt): Observable<void> {
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
    const { path } = getPathToFolderById(folders, prompt.folderId, true);
    const newName = prompt.name.replace(notAllowedSymbolsRegex, '');

    return {
      ...prompt,
      id: constructPath(...[path, newName]),
      name: newName,
      folderId: path,
    };
  }); // to send prompts with proper parentPath
