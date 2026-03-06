import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { LoginButton } from '@/src/components/Marketplace/ToolsetsDetails/LoginButton';
import { ToolsetDetailsFooterProps } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

export const SimpleToolsetDetailsFooter: React.FC<
  ToolsetDetailsFooterProps
> = ({ entity, onChangeVersion }) => {
  return (
    <div className="flex items-center justify-end gap-3 p-4 sm:gap-4">
      <ModelVersionSelect
        className="h-max"
        entities={[entity]}
        onSelect={onChangeVersion}
        currentEntity={entity}
        showVersionPrefix
      />
      <LoginButton entity={entity} />
    </div>
  );
};
