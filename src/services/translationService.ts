import type {
  LanguageCode,
  TranslationSource,
} from '../types/transcript'

export type TranslationRequest = {
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
}

export type TranslationResult = {
  translatedText: string
  source: TranslationSource
}

export const USE_REAL_TRANSLATION_API = false

const commonTranslations: Record<
  string,
  Partial<Record<LanguageCode, string>>
> = {
  '안녕하세요': {
    ko: '안녕하세요',
    en: 'Hello',
    ja: 'こんにちは',
    zh: '你好',
  },
  '테스트입니다': {
    ko: '테스트입니다',
    en: 'This is a test.',
    ja: 'テストです。',
    zh: '这是测试。',
  },
  '오늘 회의를 시작하겠습니다': {
    ko: '오늘 회의를 시작하겠습니다',
    en: "Let's start today's meeting.",
    ja: '今日の会議を始めます。',
    zh: '我们开始今天的会议。',
  },
  '반갑습니다': {
    ko: '반갑습니다',
    en: 'Nice to meet you.',
    ja: 'お会いできてうれしいです。',
    zh: '很高兴见到您。',
  },
  '제 이름은 군한입니다': {
    ko: '제 이름은 군한입니다',
    en: 'My name is Gunhan.',
    ja: '私の名前はグンハンです。',
    zh: '我叫Gunhan。',
  },
  '오늘 회의 주제는 실시간 번역입니다': {
    ko: '오늘 회의 주제는 실시간 번역입니다',
    en: "Today's meeting topic is real-time translation.",
    ja: '今日の会議のテーマはリアルタイム翻訳です。',
    zh: '今天的会议主题是实时翻译。',
  },
  '지금부터 테스트를 시작하겠습니다': {
    ko: '지금부터 테스트를 시작하겠습니다',
    en: "We'll begin the test now.",
    ja: 'これからテストを始めます。',
    zh: '现在开始测试。',
  },
  '화면이 잘 보이나요': {
    ko: '화면이 잘 보이나요?',
    en: 'Can you see the screen clearly?',
    ja: '画面はよく見えますか？',
    zh: '屏幕看得清楚吗？',
  },
  '제 목소리가 잘 들리나요': {
    ko: '제 목소리가 잘 들리나요?',
    en: 'Can you hear me clearly?',
    ja: '私の声はよく聞こえますか？',
    zh: '能听清我的声音吗？',
  },
  '다시 한번 말씀해 주세요': {
    ko: '다시 한번 말씀해 주세요',
    en: 'Please say that again.',
    ja: 'もう一度おっしゃってください。',
    zh: '请再说一遍。',
  },
  '이 내용을 기록해 주세요': {
    ko: '이 내용을 기록해 주세요',
    en: 'Please record this.',
    ja: 'この内容を記録してください。',
    zh: '请记录这段内容。',
  },
  '회의를 마무리하겠습니다': {
    ko: '회의를 마무리하겠습니다',
    en: "Let's wrap up the meeting.",
    ja: '会議を締めくくります。',
    zh: '我们来结束会议。',
  },
  '감사합니다': {
    ko: '감사합니다',
    en: 'Thank you.',
    ja: 'ありがとうございます。',
    zh: '谢谢。',
  },
}

const languagePrefixes: Record<LanguageCode, string> = {
  ko: 'KO',
  en: 'EN',
  ja: 'JA',
  zh: 'ZH',
  fr: 'FR',
}

function normalizeSourceText(text: string): string {
  return text.trim().replace(/[.!?。！？]+$/, '')
}

export async function translateTextMock(
  sourceText: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): Promise<string> {
  if (sourceLanguage === targetLanguage) {
    return sourceText
  }

  const normalizedText = normalizeSourceText(sourceText)
  const commonTranslation =
    commonTranslations[normalizedText]?.[targetLanguage]

  if (commonTranslation) {
    return commonTranslation
  }

  const prefix = languagePrefixes[targetLanguage]
  return `[${prefix}] ${sourceText}`
}

export async function translateText({
  text,
  sourceLanguage,
  targetLanguage,
}: TranslationRequest): Promise<TranslationResult> {
  const context = {
    sourceText: text,
    sourceLanguage,
    targetLanguage,
  }

  if (sourceLanguage === targetLanguage) {
    return {
      translatedText: text,
      source: 'same-language',
    }
  }

  if (!USE_REAL_TRANSLATION_API) {
    return {
      translatedText: await translateTextMock(
        text,
        sourceLanguage,
        targetLanguage,
      ),
      source: 'mock',
    }
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sourceLanguage,
        targetLanguage,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `/api/translate returned ${response.status} ${response.statusText}. `
        + `Server response: ${errorBody}`,
      )
    }

    const data = await response.json() as { translatedText?: unknown }

    if (typeof data.translatedText !== 'string' || !data.translatedText.trim()) {
      throw new Error('Translation response is invalid.')
    }

    const translatedText = data.translatedText.trim()

    return {
      translatedText,
      source: 'api',
    }
  } catch (error) {
    console.error('[translation] API translation failed', {
      ...context,
      apiCalled: true,
      apiSuccess: false,
      fallbackUsed: true,
      reason: error instanceof Error ? error.message : String(error),
    })

    const translatedText = await translateTextMock(
      text,
      sourceLanguage,
      targetLanguage,
    )

    return {
      translatedText,
      source: 'mock',
    }
  }
}
