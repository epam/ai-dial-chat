import { useForm } from 'react-hook-form';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { getLayout } from '@/src/pages/_app';

import { Field } from '@/src/components/Common/Forms/Field';
import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetTransportType } from '@epam/ai-dial-shared';

interface ToolsetForm {
  name: string;
  endpoint: string;
  description: string;
}

function ToolsetEditorPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { toolsetId: toolsetIdQuery } = router.query;

  const toolsetId = toolsetIdQuery?.toString();

  const areToolsetsLoading = useAppSelector(ToolsetSelectors.selectIsLoading);

  const isLoading = toolsetId && areToolsetsLoading;

  // below draft form for testing add toolset flow
  const { register, handleSubmit: submitWrapper } = useForm<ToolsetForm>({
    defaultValues: {
      name: '',
      endpoint: '',
      description: '',
    },
  });

  const handleSubmit = (data: ToolsetForm) => {
    dispatch(
      ToolsetActions.createToolset({
        name: data.name,
        endpoint: data.endpoint,
        transport: ToolsetTransportType.HTTP,
        allowedTools: [],
        description: data.description,
      }),
    );
  };

  return (
    <div className="flex size-full flex-col p-4">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={45} className="mx-auto" />
        </div>
      ) : (
        <form
          onSubmit={submitWrapper(handleSubmit)}
          className="flex w-full flex-col gap-4 divide-y divide-tertiary overflow-y-auto"
        >
          <Field {...register('name')} label="Name" />
          <Field {...register('endpoint')} label="Endpoint" />
          <Field {...register('description')} label="Description" />

          <button className="button button-primary py-2" type="submit">
            Create toolset
          </button>
        </form>
      )}
    </div>
  );
}

ToolsetEditorPage.getLayout = getLayout;

export default ToolsetEditorPage;

export const getServerSideProps = getCommonPageProps;
