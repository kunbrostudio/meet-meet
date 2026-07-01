import type {
  LanguageCode,
  SupportedLanguage,
  Transcript,
} from '../types/transcript'

type MockTranscriptInput = {
  id: number
  meetingId?: string
  participantId: number
  time: string
  createdAt?: string
  speakerName: string
  sourceLanguage: LanguageCode
  sourceText: string
  translatedTextByLanguage: Record<SupportedLanguage, string>
}

function createMockTranscript(input: MockTranscriptInput): Transcript {
  return {
    ...input,
    meetingId: input.meetingId ?? 'mock-meeting',
    createdAt: input.createdAt ?? `2026-06-21T${input.time}:00+09:00`,
    targetLanguage: 'ko',
    translatedText: input.translatedTextByLanguage.ko,
    translationSource: 'mock',
  }
}

export const mockTranscripts: Transcript[] = [
  createMockTranscript({
    id: 1,
    participantId: 1,
    time: '10:02',
    speakerName: 'Ken Choi',
    sourceLanguage: 'ko',
    sourceText: '오늘은 새로운 온보딩 플로우와 다음 분기 목표를 함께 이야기해 볼게요.',
    translatedTextByLanguage: {
      ko: '오늘은 새로운 온보딩 플로우와 다음 분기 목표를 함께 이야기해 볼게요.',
      en: "Today, we'll discuss the new onboarding flow and our goals for next quarter.",
      ja: '今日は新しいオンボーディングフローと次の四半期の目標について話し合いましょう。',
      zh: '今天我们来讨论新的用户引导流程和下一季度的目标。',
    },
  }),
  createMockTranscript({
    id: 2,
    participantId: 2,
    time: '10:03',
    speakerName: 'Sarah Miller',
    sourceLanguage: 'en',
    sourceText: 'The early user feedback has been really encouraging so far.',
    translatedTextByLanguage: {
      ko: '지금까지 초기 사용자 피드백은 매우 긍정적이었습니다.',
      en: 'The early user feedback has been really encouraging so far.',
      ja: 'これまでの初期ユーザーからのフィードバックは、とても好意的です。',
      zh: '到目前为止，早期用户的反馈非常积极。',
    },
  }),
  createMockTranscript({
    id: 3,
    participantId: 3,
    time: '10:04',
    speakerName: 'Yuki Tanaka',
    sourceLanguage: 'ja',
    sourceText: 'デザインシステムの更新も今週中に完了する予定です。',
    translatedTextByLanguage: {
      ko: '디자인 시스템 업데이트도 이번 주 안에 완료할 예정입니다.',
      en: 'The design system update is also scheduled to be completed this week.',
      ja: 'デザインシステムの更新も今週中に完了する予定です。',
      zh: '设计系统的更新也计划在本周内完成。',
    },
  }),
  createMockTranscript({
    id: 4,
    participantId: 2,
    time: '10:05',
    speakerName: 'Sarah Miller',
    sourceLanguage: 'en',
    sourceText: "Let's prioritize clarity and keep the first experience as simple as possible.",
    translatedTextByLanguage: {
      ko: '명확성을 우선하고 첫 경험을 최대한 단순하게 유지합시다.',
      en: "Let's prioritize clarity and keep the first experience as simple as possible.",
      ja: '分かりやすさを優先し、最初の体験をできるだけシンプルにしましょう。',
      zh: '让我们优先考虑清晰度，并尽可能简化首次体验。',
    },
  }),
  createMockTranscript({
    id: 5,
    participantId: 4,
    time: '10:06',
    speakerName: 'Lucas Martin',
    sourceLanguage: 'fr',
    sourceText: 'Je vais partager le calendrier révisé après la réunion.',
    translatedTextByLanguage: {
      ko: '회의 후 수정된 일정을 공유하겠습니다.',
      en: 'I will share the revised schedule after the meeting.',
      ja: '会議後に修正したスケジュールを共有します。',
      zh: '我会在会议后分享修改后的日程安排。',
    },
  }),
]

export function getTranslatedText(
  transcript: Transcript,
  targetLanguage: string,
): string {
  if (transcript.targetLanguage === targetLanguage) {
    return transcript.translatedText
  }

  return transcript.translatedTextByLanguage[
    targetLanguage as SupportedLanguage
  ] ?? transcript.translatedTextByLanguage.en
}

export function getPendingTranslationText(): Record<SupportedLanguage, string> {
  return {
    ko: '번역 준비 중입니다.',
    en: 'Translation will appear here.',
    ja: '翻訳がここに表示されます。',
    zh: '翻译将显示在这里。',
  }
}
