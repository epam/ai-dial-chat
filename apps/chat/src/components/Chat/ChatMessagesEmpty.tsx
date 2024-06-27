import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { HEADER_TITLE_TEXT } from '@/src/constants/chat';

import { PopularPrompts } from '@/src/components/Chat/PopularPrompts';

import SecondaryLogo from '@/public/images/icons/secondary-logo.svg';

// Leave this for now for the next story

// export const ApplicationNoMessages = ({
//   application,
// }: {
//   application: DialAIEntityModel;
// }) => (
//   <>
//     <div className="flex flex-col items-center justify-center gap-10">
//       <div>
//         {application.id === 'dall-e-3' && (
//           <DalleAppIcon width={60} height={60} />
//         )}
//         {application.id === 'rag' && <RagAppIcon width={60} height={60} />}
//         {application.id === 'hr-buddy' && (
//           <HRBuddyIcon width={60} height={60} />
//         )}
//       </div>
//       <div className="ml-3 font-weave text-[36px] font-bold text-pr-primary-700">
//         {application.name}
//       </div>
//       <div className="flex items-center justify-center">
//         {application.id === 'dall-e-3' && (
//           <span>Let me turn your imagination into imagery.</span>
//         )}
//         {application.id === 'hr-buddy' && (
//           <span>Welcome to the dedicated chatbot to HR Campaigns!</span>
//         )}
//       </div>
//     </div>
//   </>
// );

export const ModelMessagesEmpty = ({ model }: { model: DialAIEntityModel }) => (
  <>
    <div className="flex items-center justify-center">
      <SecondaryLogo width={54} height={60} />
      <span className="ml-3 font-weave text-[30px] font-bold text-pr-primary-700">
        {HEADER_TITLE_TEXT}
      </span>
    </div>
    <div className="flex items-center justify-center">
      <PopularPrompts model={model} />
    </div>
  </>
);

export const ChatMessagesEmpty = ({
  conversation,
}: {
  conversation: Conversation;
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelId = conversation.model.id;
  const model = modelsMap[modelId];

  return (
    <>
      {/*Leave this for now for the next story*/}
      {/*{model?.type === 'application' || model?.id === 'dall-e-3' ? (*/}
      {/*  <ApplicationNoMessages application={model} />*/}
      {/*) : (*/}
      {model && <ModelMessagesEmpty model={model} />}
      {/*)}*/}
    </>
  );
};
