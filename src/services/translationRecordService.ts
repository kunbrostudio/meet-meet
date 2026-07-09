import { STORAGE_KEYS } from '../constants/storageKeys'
import type {
  TranslationRecord,
  TranslationRequestInput,
} from '../types/translation'
import { translateText } from './translationService'

export function getTranslationCacheKey(
  sourceType: TranslationRecord['sourceType'],
  sourceId: string,
  targetLanguage: string,
): string {
  return `${sourceType}:${sourceId}:${targetLanguage}`
}

function createTranslationId(): string {
  return crypto.randomUUID?.()
    ?? `translation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function dedupeTranslations(
  translations: TranslationRecord[],
): TranslationRecord[] {
  const map = new Map<string, TranslationRecord>()

  for (const translation of translations) {
    map.set(
      getTranslationCacheKey(
        translation.sourceType,
        translation.sourceId,
        translation.targetLanguage,
      ),
      translation,
    )
  }

  return [...map.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
}

export function findTranslation(
  translations: TranslationRecord[],
  sourceType: TranslationRecord['sourceType'],
  sourceId: string,
  targetLanguage: string,
): TranslationRecord | undefined {
  const cacheKey = getTranslationCacheKey(sourceType, sourceId, targetLanguage)
  return translations.find((translation) => (
    getTranslationCacheKey(
      translation.sourceType,
      translation.sourceId,
      translation.targetLanguage,
    ) === cacheKey
  ))
}

export function saveTranslations(
  meetingId: string,
  translations: TranslationRecord[],
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.meetingTranslations(meetingId),
      JSON.stringify(dedupeTranslations(translations)),
    )
  } catch (error) {
    console.error('[translation-record] Failed to save translations', error)
  }
}

export function loadTranslations(meetingId: string): TranslationRecord[] {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.meetingTranslations(meetingId))
    const translations = value ? JSON.parse(value) as TranslationRecord[] : []
    return Array.isArray(translations)
      ? dedupeTranslations(translations)
      : []
  } catch (error) {
    console.error('[translation-record] Failed to load translations', error)
    return []
  }
}

export function clearTranslations(meetingId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.meetingTranslations(meetingId))
  } catch (error) {
    console.error('[translation-record] Failed to clear translations', error)
  }
}

export async function createManualTranslation(
  input: TranslationRequestInput,
): Promise<TranslationRecord> {
  const sourceText = input.sourceText.trim()

  if (!sourceText) {
    throw new Error('EMPTY_TRANSLATION_SOURCE')
  }

  const result = await translateText({
    text: sourceText,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  })

  return {
    type: 'translation',
    translationId: createTranslationId(),
    roomCode: input.roomCode,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceText,
    translatedText: result.translatedText,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    createdAt: new Date().toISOString(),
  }
}
