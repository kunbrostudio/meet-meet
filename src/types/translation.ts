import type { LanguageCode } from './transcript'

export type TranslationSourceType = 'chat' | 'transcript'

export type TranslationRecord = {
  type: 'translation'
  translationId: string
  roomCode: string
  sourceType: TranslationSourceType
  sourceId: string
  sourceText: string
  translatedText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  status: 'pending' | 'success' | 'failed' | 'skipped'
  errorMessage?: string
  createdAt: string
}

export type TranslationRequestInput = {
  roomCode: string
  sourceType: TranslationSourceType
  sourceId: string
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
}
