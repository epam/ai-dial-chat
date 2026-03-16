import NextAuth from 'next-auth';

import { authOptions } from '@/src/utils/auth/auth-options';

export default NextAuth(authOptions);
