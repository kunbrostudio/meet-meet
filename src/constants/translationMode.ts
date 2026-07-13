export const TRANSLATION_MODE = {
  DEV: 'dev',
  FREE: 'free',
  PREMIUM: 'premium',
} as const

export type TranslationMode =
  typeof TRANSLATION_MODE[keyof typeof TRANSLATION_MODE]

const configuredTranslationMode = import.meta.env.VITE_TRANSLATION_MODE

function resolveTranslationMode(): TranslationMode {
  if (
    configuredTranslationMode === TRANSLATION_MODE.DEV
    || configuredTranslationMode === TRANSLATION_MODE.FREE
    || configuredTranslationMode === TRANSLATION_MODE.PREMIUM
  ) {
    return configuredTranslationMode
  }

  return import.meta.env.DEV
    ? TRANSLATION_MODE.DEV
    : TRANSLATION_MODE.FREE
}

export const ACTIVE_TRANSLATION_MODE = resolveTranslationMode()

export const TRANSLATION_MODE_CONFIG = {
  mode: ACTIVE_TRANSLATION_MODE,
  canUseManualTranslation:
    ACTIVE_TRANSLATION_MODE === TRANSLATION_MODE.DEV
    || ACTIVE_TRANSLATION_MODE === TRANSLATION_MODE.PREMIUM,
  canUseAutoTranslation:
    ACTIVE_TRANSLATION_MODE === TRANSLATION_MODE.DEV
    || ACTIVE_TRANSLATION_MODE === TRANSLATION_MODE.PREMIUM,
  canUseTranscriptView: ACTIVE_TRANSLATION_MODE !== TRANSLATION_MODE.FREE,
  isPremiumLocked: ACTIVE_TRANSLATION_MODE === TRANSLATION_MODE.FREE,
}
