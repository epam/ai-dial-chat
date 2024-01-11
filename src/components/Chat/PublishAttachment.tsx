import { DialFile } from "@/src/types/files";
import { IconFile } from "@tabler/icons-react";
import Tooltip from "../Common/Tooltip";

interface Props {
  item: Omit<DialFile, "contentLength">;
}

export const PublishAttachment = ({
  item,
}: Props) => {
  if(!item) return null;
  return (
    <div className="flex max-w-full items-center">
        <IconFile className="mr-2 shrink-0 text-secondary" size={18} />
        <div className="flex min-w-0 shrink flex-col">
            <Tooltip tooltip={item.name} triggerClassName="block max-w-full truncate">
                {item.name}
            </Tooltip>
            <div className="block max-w-full truncate text-secondary">{item.relativePath}</div>
        </div>
    </div>
  );
}
