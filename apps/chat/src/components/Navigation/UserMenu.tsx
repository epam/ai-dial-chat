/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { readableColor } from 'polished';
import randomColor from 'randomcolor';
import { memo, useMemo, useState } from 'react';
import { useUser } from '../../context/auth/UserContext';

export const UserMenu = memo(() => {
  const { status, user } = useUser();

  if (status !== 'authenticated' || !user) {
    return null;
  }

  const email = (user.claims['email'] as string) ?? user.sub;
  const image = user.claims['image'] as string | undefined;
  const [showFallbackIcon, setShowFallbackIcon] = useState(!image);

  const bg = randomColor({
    luminosity: 'bright',
    seed: email,
  });

  const textColor = readableColor(bg);

  const shortName = useMemo(() => {
    const nameClaim = user.claims['name'] as string | undefined;
    const [part1, part2] = (nameClaim as string)?.split(' ') ?? [];
    if (part1 && part2) {
      return `${part1[0]}${part2[0]}`;
    }

    return nameClaim;
  }, [user.claims]);

  return (
    <div className="flex size-[60px] items-center justify-center">
      <button className="flex size-[44px] items-center justify-center rounded-full border border-transparent focus-within:border-focus hover:bg-accent-primary-alpha">
        <DialTooltip tooltip={email}>
          {showFallbackIcon ? (
            <div
              className="flex size-[28px] items-center justify-center rounded-full text-[12px]/[16px] font-normal"
              style={{ backgroundColor: bg, color: textColor }}
            >
              {shortName}
            </div>
          ) : (
            <img
              className="rounded-full"
              src={image}
              width={28}
              height={28}
              alt="User avatar"
              onError={() => setShowFallbackIcon(true)}
            />
          )}
        </DialTooltip>
      </button>
    </div>
  );
  // return (
  //   <div className="relative flex items-center">
  //     {open && (
  //       <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-secondary bg-layer-1 shadow-md">
  //         <div className="px-3 py-2 text-sm text-secondary">
  //           {t('auth.signedInAs', { email })}
  //         </div>
  //         <div className="border-t border-secondary">
  //           <form method="POST" action="/api/v1/auth/logout">
  //             <button
  //               type="submit"
  //               className="hover:bg-accent-secondary w-full px-3 py-2 text-left text-sm"
  //             >
  //               {t('auth.signOut')}
  //             </button>
  //           </form>
  //         </div>
  //       </div>
  //     )}
  //   </div>
  // );
});

export default memo(UserMenu);
