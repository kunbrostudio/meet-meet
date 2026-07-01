import { STORAGE_KEYS } from '../constants/storageKeys'
import type { CaptionPreferences, CaptionSize } from '../types'

const DEFAULT_CAPTION_PREFERENCES: CaptionPreferences = {
  size: 'medium',
}

const captionSizes: CaptionSize[] = ['small', 'medium', 'large']

export function loadCaptionPreferences(): CaptionPreferences {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.captionPreferences)

    if (!value) {
      return DEFAULT_CAPTION_PREFERENCES
    }

    const preferences = JSON.parse(value) as Partial<CaptionPreferences>

    return {
      size: captionSizes.includes(preferences.size as CaptionSize)
        ? preferences.size as CaptionSize
        : DEFAULT_CAPTION_PREFERENCES.size,
    }
  } catch (error) {
    console.error('[caption-preferences] Failed to load preferences', error)
    return DEFAULT_CAPTION_PREFERENCES
  }
}

export function saveCaptionPreferences(
  preferences: CaptionPreferences,
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.captionPreferences,
      JSON.stringify(preferences),
    )
  } catch (error) {
    console.error('[caption-preferences] Failed to save preferences', error)
  }
}
