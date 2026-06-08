import { ApiEndpoints, post } from './base';

interface TranscribeAudioParams {
  audioUrl: string;
  mimeType: string;
  deployment: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message: { content?: string } }>;
  error?: string;
}

export const transcribeAudio = async ({
  audioUrl,
  mimeType,
  deployment,
}: TranscribeAudioParams): Promise<string> => {
  const response = await post<ChatCompletionResponse>(
    ApiEndpoints.CHAT_COMPLETIONS,
    {
      deployment,
      messages: [
        {
          role: 'user',
          content: 'Transcribe the audio, return the content only, no extra',
          custom_content: {
            attachments: [
              { type: mimeType, title: 'recording', url: audioUrl },
            ],
          },
        },
      ],
    },
  );
  if (response.error) {
    throw new Error(response.error);
  }
  return response.choices?.[0]?.message?.content ?? '';
};
