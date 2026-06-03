interface Props {
  bg: string;
  textColor: string;
  shortName: string | undefined;
  initialsClassName?: string;
}

export default function AvatarInitials({
  bg,
  textColor,
  shortName,
  initialsClassName = 'dial-tiny-text',
}: Props) {
  return (
    <div
      className={`flex size-[28px] flex-shrink-0 items-center justify-center rounded-full ${initialsClassName}`}
      style={{ backgroundColor: bg, color: textColor }}
    >
      {shortName}
    </div>
  );
}
