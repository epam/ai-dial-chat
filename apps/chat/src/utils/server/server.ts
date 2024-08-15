import { NextApiRequest } from 'next';

import { constructPath } from '../app/file';
import { ApiUtils } from './api';

import { Response as NodeFetchResponse } from 'node-fetch';

export class ServerUtils {
  public static getEntityTypeFromPath = (
    req: NextApiRequest,
  ): string | undefined => {
    return Array.isArray(req.query.entitytype) ? '' : req.query.entitytype;
  };

  public static encodeSlugs = (slugs: (string | undefined)[]): string =>
    constructPath(
      ...slugs
        .filter(Boolean)
        .map((part) => ApiUtils.safeEncodeURIComponent(part as string)),
    );

  public static saveDecodeURI = (str: string): string => {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  };

  public static getErrorMessageFromResponse = async (
    res: Response | NodeFetchResponse,
  ): Promise<string | null> => {
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return this.saveDecodeURI(
          typeof json === 'string' ? json : JSON.stringify(json),
        );
      } catch {
        return this.saveDecodeURI(text);
      }
    } catch {
      return null;
    }
  };
}
