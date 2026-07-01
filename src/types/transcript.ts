export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'fr'
export type SupportedLanguage = Exclude<LanguageCode, 'fr'>
export type TranslationSource = 'api' | 'mock' | 'same-language'

export type Transcript = {
  id: number
  meetingId: string
  participantId: number
  speakerId?: number
  time: string
  createdAt: string
  speakerName: string
  sourceLanguage: LanguageCode
  sourceText: string
  targetLanguage: LanguageCode
  translatedText: string
  translationSource: TranslationSource
  translatedTextByLanguage: Record<SupportedLanguage, string>
}
