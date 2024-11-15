import { Observable, catchError, filter, map, of, throwError } from 'rxjs';

import { HTTPMethod } from '@/src/types/http';
import { InstalledModel } from '@/src/types/models';

import {
  CLIENTDATA_PATH,
  INSTALLED_DEPLOYMENTS,
} from '@/src/constants/client-data';

import { ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { getFileRootId } from '../id';
import { FileService } from './file-service';

const convertToBlob = <T>(data: T) => {
  // Stringify the JSON object
  const jsonString = JSON.stringify(data);

  // Create a Blob object with the JSON string and
  // set the content type as "application/json"
  return new Blob([jsonString], { type: 'application/json' });
};

interface Result {
  success?: boolean;
  error?: string;
  percent?: number;
}

export class ClientDataService {
  private static getUrl(fileName: string) {
    return constructPath(
      'api',
      getFileRootId(),
      CLIENTDATA_PATH,
      ApiUtils.encodeApiUrl(fileName),
    );
  }
  private static saveData<T>(fileName: string, data: T): Observable<Result> {
    const formData = new FormData();
    formData.append('attachment', convertToBlob(data), fileName);
    return FileService.sendFile(
      formData,
      CLIENTDATA_PATH,
      fileName,
      HTTPMethod.PUT,
    ).pipe(
      filter(
        ({ result, percent }) =>
          typeof result !== 'undefined' || typeof percent !== 'undefined',
      ),
      map(({ result, percent }) => {
        if (result) {
          return { success: true };
        }
        return { percent };
      }),
      catchError((error) => {
        console.error(`Failed save file ${fileName}`, error);
        return of({ success: false, error: `Failed save file ${fileName}` });
      }),
    );
  }

  private static getData<T>(fileName: string): Observable<T | null> {
    try {
      return ApiUtils.request(this.getUrl(fileName)).pipe(
        map((entity: T) => {
          return entity;
        }),
      );
    } catch (error) {
      console.error(`Failed read file ${fileName}`, error);
      return throwError(() => error);
    }
  }

  public static saveInstalledDeployments(
    installedDeployments: InstalledModel[],
  ) {
    return this.saveData<InstalledModel[]>(
      INSTALLED_DEPLOYMENTS,
      installedDeployments,
    );
  }

  public static getInstalledDeployments() {
    return this.getData<InstalledModel[]>(INSTALLED_DEPLOYMENTS);
  }
}
