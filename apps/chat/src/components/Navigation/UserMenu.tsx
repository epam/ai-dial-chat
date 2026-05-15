import { IconUserCircle } from '@tabler/icons-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../context/auth/UserContext';

export const UserMenu = memo(() => {
  const { t } = useTranslation();
  const { status, user } = useUser();
  const [open, setOpen] = useState(false);

  if (status !== 'authenticated' || !user) {
    return null;
  }

  const email = (user.claims['email'] as string) ?? user.sub;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label={t('auth.signedInAs', { email })}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        className="hover:bg-accent-secondary flex items-center gap-1 rounded p-1 focus:outline-none"
      >
        <IconUserCircle size={24} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-secondary bg-layer-1 shadow-md">
          <div className="px-3 py-2 text-sm text-secondary">
            {t('auth.signedInAs', { email })}
          </div>
          <div className="border-t border-secondary">
            <form method="POST" action="/api/v1/auth/logout">
              <button
                type="submit"
                className="hover:bg-accent-secondary w-full px-3 py-2 text-left text-sm"
              >
                {t('auth.signOut')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

UserMenu.displayName = 'UserMenu';

export default UserMenu;
