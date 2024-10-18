import { Observable, catchError, filter, map, of } from 'rxjs';

import { FileService } from '@/src/utils/app/data/file-service';
import { ApiUtils } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';

interface Result {
  success?: boolean;
  error?: string;
  percent?: number;
}

export class TextFileService {
  public static getFileContent(path: string): Observable<string> {
    return ApiUtils.requestText(path);
  }

  public static updateContent(
    relativePath: string,
    fileName: string,
    data: File,
  ): Observable<Result> {
    const formData = new FormData();
    formData.append('attachments', data, fileName);

    return FileService.sendFile(
      formData,
      relativePath,
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
}
