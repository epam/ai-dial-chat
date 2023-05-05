import { IconLogin, IconLogout, IconUser } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { FC } from 'react';

import Image from 'next/image';

const UserIcon: FC<{ image?: string | null; title?: string | null }> = ({
  image,
  title,
}) => {
  if (image) {
    return (
      <Image
        src={image}
        alt={title ?? ''}
        width={32}
        height={32}
        className="rounded-full"
      />
    );
  }

  return <IconUser />;
};

export const User: FC = () => {
  const { data: session } = useSession();

  console.log(session?.user);
  return (
    <div className="flex items-center gap-2">
      {session && (
        <>
          <UserIcon image={session?.user?.image} title={session?.user?.name} />
          {session?.user?.name ?? ''}
        </>
      )}
      <button
        type="button"
        onClick={() =>
          session
            ? signOut({ redirect: false })
            : signIn('azure-ad', { redirect: true })
        }
      >
        {session ? <IconLogout /> : <IconLogin />}
      </button>
    </div>
  );
};
