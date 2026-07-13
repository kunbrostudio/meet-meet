import { STORAGE_KEYS } from '../constants/storageKeys'
import type {
  TranslationRecord,
  TranslationRequestInput,
} from '../types/translation'
import { translateText } from './translationService'

function isFallbackTranslation(
  translatedText: string,
  targetLanguage: string,
): boolean {
  const prefix = `[${targetLanguage.toUpperCase()}]`
  return translatedText.trim().startsWith(prefix)
}

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

export function shouldAutoTranslateText(
  text: string,
  sourceLanguage: string,
  previousText?: string,
): boolean {
  const normalizedText = text.trim()

  if (!normalizedText) {
    return false
  }

  if (!/[A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]/.test(normalizedText)) {
    return false
  }

  if (previousText) {
    const normalizedPrevious = previousText.trim()
    if (
      normalizedPrevious === normalizedText
      || normalizedPrevious.includes(normalizedText)
      || normalizedText.includes(normalizedPrevious)
    ) {
      return false
    }
  }

  if (sourceLanguage === 'ko') {
    const koreanLetters = normalizedText.match(/[가-힣]/g)?.length ?? 0
    return koreanLetters > 2
  }

  if (sourceLanguage === 'en') {
    const words = normalizedText.split(/\s+/).filter(Boolean)
    return words.length >= 2
  }

  return normalizedText.length > 3
}

export function dedupeTranslations(
  translations: TranslationRecord[],
): TranslationRecord[] {
  const map = new Map<string, TranslationRecord>()

  for (const translation of translations) {
    const normalizedTranslation: TranslationRecord = {
      ...translation,
      status:
        translation.status
        ?? (
          translation.translatedText.trim()
            ? 'success'
            : 'failed'
        ),
    }
    map.set(
      getTranslationCacheKey(
        normalizedTranslation.sourceType,
        normalizedTranslation.sourceId,
        normalizedTranslation.targetLanguage,
      ),
      normalizedTranslation,
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

  try {
    console.debug('[translation] request', {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceTextLength: sourceText.length,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    })

    const result = await translateText({
      text: sourceText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })

    if (isFallbackTranslation(result.translatedText, input.targetLanguage)) {
      return {
        type: 'translation',
        translationId: createTranslationId(),
        roomCode: input.roomCode,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceText,
        translatedText: '',
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        status: 'skipped',
        errorMessage: 'fallback-translation',
        createdAt: new Date().toISOString(),
      }
    }

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
      status: 'success',
      createdAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      type: 'translation',
      translationId: createTranslationId(),
      roomCode: input.roomCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceText,
      translatedText: '',
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      createdAt: new Date().toISOString(),
    }
  }
}
