import NextAuth, { AuthOptions } from 'next-auth';
import AzureProvider from 'next-auth/providers/azure-ad';

export const authOptions: AuthOptions = {
  providers: [
    AzureProvider({
      clientId: process.env.AUTH_CLIENT_ID as string,
      clientSecret: process.env.AUTH_CLIENT_SECRET as string,
      tenantId: process.env.AUTH_TENANT_ID as string,
      name: 'EPAM SSO',
      authorization: { params: { scope: 'openid profile user.Read email' } },
    }),
  ],
  
};
export default NextAuth(authOptions);
