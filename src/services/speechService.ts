import type {
  LanguageCode,
  SpeechRecognitionLanguage,
} from '../types/transcript'

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      0: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionErrorEvent = Event & {
  error: string
}

export type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export type StartSpeechRecognitionOptions = {
  language: LanguageCode | SpeechRecognitionLanguage
  onResult: (text: string) => void
  onInterimResult?: (text: string) => void
  shouldRestart?: () => boolean
  onStart?: () => void
  onEnd?: () => void
  onError?: (errorCode: string) => void
}

const recognitionLanguageBySource: Record<
  LanguageCode | SpeechRecognitionLanguage,
  string
> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  fr: 'fr-FR',
  'ko-KR': 'ko-KR',
  'en-US': 'en-US',
}

let activeRecognition: BrowserSpeechRecognition | null = null
let recognitionStarted = false
let manualStopRequested = false
let restartTimer: number | null = null
let isStartingRecognition = false

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition
    ?? speechWindow.webkitSpeechRecognition
    ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

export function createSpeechRecognition(
  language: LanguageCode | SpeechRecognitionLanguage,
): BrowserSpeechRecognition | null {
  const SpeechRecognition = getSpeechRecognitionConstructor()

  if (!SpeechRecognition) {
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.lang =
    recognitionLanguageBySource[language] ?? recognitionLanguageBySource.en
  recognition.continuous = true
  recognition.interimResults = true
  return recognition
}

export function startSpeechRecognition({
  language,
  onResult,
  onInterimResult,
  shouldRestart,
  onStart,
  onEnd,
  onError,
}: StartSpeechRecognitionOptions): boolean {
  if (activeRecognition || isStartingRecognition) {
    return false
  }

  manualStopRequested = false
  isStartingRecognition = true

  const recognition = createSpeechRecognition(language)

  if (!recognition) {
    isStartingRecognition = false
    onError?.('unsupported')
    return false
  }

  activeRecognition = recognition
  let lastErrorCode = ''

  recognition.onstart = () => {
    isStartingRecognition = false
    recognitionStarted = true
    onStart?.()
  }

  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript.trim()

      if (result.isFinal && transcript) {
        onResult(transcript)
      } else if (transcript) {
        onInterimResult?.(transcript)
      }
    }
  }

  recognition.onerror = (event) => {
    lastErrorCode = event.error
    if (event.error !== 'aborted') {
      console.warn('[speech] recognition error', event.error)
    }
    isStartingRecognition = false
    recognitionStarted = false
    activeRecognition = null
    onError?.(event.error)
  }

  recognition.onend = () => {
    const canRestart =
      !manualStopRequested
      && shouldRestart?.() === true
      && !['not-allowed', 'service-not-allowed', 'network'].includes(lastErrorCode)

    recognitionStarted = false
    activeRecognition = null
    onEnd?.()

    if (canRestart) {
      if (restartTimer !== null) {
        window.clearTimeout(restartTimer)
      }
      restartTimer = window.setTimeout(() => {
        restartTimer = null
        if (!manualStopRequested && shouldRestart?.() === true) {
          startSpeechRecognition({
            language,
            onResult,
            onInterimResult,
            shouldRestart,
            onStart,
            onEnd,
            onError,
          })
        }
      }, 350)
    }
  }

  try {
    recognition.start()
    return true
  } catch (error) {
    console.warn('[speech] recognition error', error)
    isStartingRecognition = false
    recognitionStarted = false
    activeRecognition = null
    onError?.('start-failed')
    return false
  }
}

export function stopSpeechRecognition(): void {
  manualStopRequested = true
  if (restartTimer !== null) {
    window.clearTimeout(restartTimer)
    restartTimer = null
  }

  if (!activeRecognition) {
    isStartingRecognition = false
    recognitionStarted = false
    return
  }

  try {
    activeRecognition.stop()
  } catch (error) {
    console.warn('[speech] recognition error', error)
    activeRecognition = null
    isStartingRecognition = false
    recognitionStarted = false
  }
}

export function getSpeechRecognitionStatus(): boolean {
  return recognitionStarted || activeRecognition !== null || isStartingRecognition
}
