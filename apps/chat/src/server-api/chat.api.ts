import { ApiEndpoints, post } from './base';

interface TranscribeAudioParams {
  audioUrl: string;
  mimeType: string;
  deployment: string;
  signal?: AbortSignal;
}

export const transcribeAudio = async ({
  audioUrl,
  mimeType,
  deployment,
  signal,
}: TranscribeAudioParams): Promise<string> => {
  /* The generated MessageDto exposes customContent, but this endpoint accepts
   * custom_content and its generated runtime performs no name conversion.
   * Keep this existing raw wrapper until that OpenAPI schema collision is fixed. */
  const response = await post<{
    choices?: Array<{ message: { content?: string } }>;
    error?: string;
  }>(
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
    { signal },
  );
  if (response.error) throw new Error(response.error);
  return response.choices?.[0]?.message?.content ?? '';
};
