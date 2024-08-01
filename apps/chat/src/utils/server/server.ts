import { NextApiRequest } from 'next';

import { constructPath } from '../app/file';
import { ApiUtils } from './api';

import { Response } from 'node-fetch';

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

  public static getErrorMessageFromResponse = async (
    res: Response,
  ): Promise<string | null> => {
   try {
      return (await res.json()) as string;
    } catch {
      try {
        return await res?.text();
      } catch {
        return null;
      }
    }
  };
}
