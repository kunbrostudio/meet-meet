export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'fr'
export type SupportedLanguage = Exclude<LanguageCode, 'fr'>
export type TranslationSource = 'api' | 'mock' | 'same-language'
export type SpeechRecognitionLanguage = 'ko-KR' | 'en-US'

export type Transcript = {
  id: number
  transcriptId?: string
  meetingId: string
  roomCode?: string
  participantId: number
  speakerId?: number
  speakerIdentity?: string
  speakerRole?: 'host' | 'guest'
  time: string
  createdAt: string
  speakerName: string
  sourceLanguage: LanguageCode
  recognitionLanguage?: SpeechRecognitionLanguage
  sourceText: string
  targetLanguage: LanguageCode
  translatedText: string
  translationSource: TranslationSource
  translatedTextByLanguage: Record<SupportedLanguage, string>
  isFinal?: boolean
}
