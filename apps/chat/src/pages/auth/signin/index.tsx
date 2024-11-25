import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { useRouter } from 'next/router';

export default function Signin() {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('keycloak');
    } else if (status === 'authenticated') {
      const { callbackUrl } = router.query;
      router.replace(callbackUrl?.toString() ?? '/');
    }
  }, [status, router]);

  return <div></div>;
}

Signin.getLayout = function (page: JSX.Element) {
  return page;
};
