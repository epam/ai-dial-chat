import type { AuthSource } from '../auth-source.enum';
import type { SessionUser } from './session.types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
    authSource?: AuthSource;
  }
}
