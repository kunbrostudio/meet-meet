import type { LanguageCode } from '../types/transcript'

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
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export type StartSpeechRecognitionOptions = {
  language: LanguageCode
  onResult: (text: string) => void
  onStart?: () => void
  onEnd?: () => void
  onError?: (errorCode: string) => void
}

const recognitionLanguageBySource: Record<LanguageCode, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  fr: 'fr-FR',
}

let activeRecognition: BrowserSpeechRecognition | null = null
let recognitionStarted = false

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
  language: LanguageCode,
): BrowserSpeechRecognition | null {
  const SpeechRecognition = getSpeechRecognitionConstructor()

  if (!SpeechRecognition) {
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.lang =
    recognitionLanguageBySource[language] ?? recognitionLanguageBySource.en
  recognition.continuous = true
  recognition.interimResults = false
  return recognition
}

export function startSpeechRecognition({
  language,
  onResult,
  onStart,
  onEnd,
  onError,
}: StartSpeechRecognitionOptions): boolean {
  if (activeRecognition) {
    return false
  }

  const recognition = createSpeechRecognition(language)

  if (!recognition) {
    onError?.('unsupported')
    return false
  }

  activeRecognition = recognition

  recognition.onstart = () => {
    recognitionStarted = true
    onStart?.()
  }

  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript.trim()

      if (result.isFinal && transcript) {
        onResult(transcript)
      }
    }
  }

  recognition.onerror = (event) => {
    if (event.error !== 'aborted') {
      console.warn('[speech] recognition error', event.error)
    }
    recognitionStarted = false
    activeRecognition = null
    onError?.(event.error)
  }

  recognition.onend = () => {
    recognitionStarted = false
    activeRecognition = null
    onEnd?.()
  }

  try {
    recognition.start()
    return true
  } catch (error) {
    console.warn('[speech] recognition error', error)
    recognitionStarted = false
    activeRecognition = null
    onError?.('start-failed')
    return false
  }
}

export function stopSpeechRecognition(): void {
  if (!activeRecognition) {
    recognitionStarted = false
    return
  }

  try {
    activeRecognition.stop()
  } catch (error) {
    console.warn('[speech] recognition error', error)
    activeRecognition = null
    recognitionStarted = false
  }
}

export function getSpeechRecognitionStatus(): boolean {
  return recognitionStarted || activeRecognition !== null
}
