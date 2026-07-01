import type {
  MeetingSummary,
  SummaryActionItem,
  SummaryStat,
} from '../types/meeting'
import type { Transcript } from '../types/transcript'

export type MeetingStats = {
  transcriptCount: number
  participantCount: number
  languageCount: number
  firstTranscriptTime: string
  lastTranscriptTime: string
  duration: string
}

const actionKeywords = [
  '해야',
  '하겠습니다',
  '공유',
  '전달',
  '확인',
  '마무리',
  '일정',
  '목표',
  'todo',
  'action',
  'share',
  'check',
  'finish',
]

function uniqueTranscripts(transcripts: Transcript[]): Transcript[] {
  const seen = new Set<string>()

  return transcripts.filter((transcript) => {
    const text = transcript.sourceText.trim()

    if (!text || seen.has(text)) {
      return false
    }

    seen.add(text)
    return true
  })
}

function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) {
    return '0분'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`
  }

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`
  }

  return `${seconds}초`
}

function formatMeetingDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function generateMeetingSummary(
  transcripts: Transcript[],
): string[] {
  const uniqueItems = uniqueTranscripts(transcripts)

  if (uniqueItems.length === 0) {
    return []
  }

  const first = uniqueItems[0]
  const latest = uniqueItems[uniqueItems.length - 1]
  const longest = [...uniqueItems].sort(
    (a, b) => b.sourceText.length - a.sourceText.length,
  )[0]

  return uniqueTranscripts([longest, latest, first])
    .slice(0, 3)
    .map((transcript) => transcript.sourceText)
}

export function generateActionItems(
  transcripts: Transcript[],
): SummaryActionItem[] {
  const detectedItems = uniqueTranscripts(transcripts).filter((transcript) => {
    const normalizedText = transcript.sourceText.toLowerCase()
    return actionKeywords.some((keyword) => normalizedText.includes(keyword))
  })

  if (detectedItems.length === 0) {
    return [{
      text: '추가 액션 아이템이 감지되지 않았습니다.',
      owner: '-',
      due: '-',
    }]
  }

  return detectedItems.map((transcript) => ({
    text: transcript.sourceText,
    owner: transcript.speakerName,
    due: '회의 후',
  }))
}

export function getMeetingStats(transcripts: Transcript[]): MeetingStats {
  if (transcripts.length === 0) {
    return {
      transcriptCount: 0,
      participantCount: 0,
      languageCount: 0,
      firstTranscriptTime: '-',
      lastTranscriptTime: '-',
      duration: '0분',
    }
  }

  const sortedTranscripts = [...transcripts].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
  const firstTranscript = sortedTranscripts[0]
  const lastTranscript = sortedTranscripts[sortedTranscripts.length - 1]
  const participantCount = new Set(
    transcripts.map((transcript) => transcript.participantId),
  ).size
  const languageCount = new Set(
    transcripts.flatMap((transcript) => [
      transcript.sourceLanguage,
      transcript.targetLanguage,
    ]),
  ).size
  const durationMilliseconds = Math.max(
    0,
    Date.parse(lastTranscript.createdAt) - Date.parse(firstTranscript.createdAt),
  )

  return {
    transcriptCount: transcripts.length,
    participantCount,
    languageCount,
    firstTranscriptTime: firstTranscript.time,
    lastTranscriptTime: lastTranscript.time,
    duration: formatDuration(durationMilliseconds),
  }
}

export function createTranscriptBasedSummary(
  meetingTitle: string,
  meetingDate: string,
  transcripts: Transcript[],
): MeetingSummary {
  const stats = getMeetingStats(transcripts)
  const summaryStats: SummaryStat[] = [
    {
      id: 'duration',
      icon: 'clock',
      value: stats.duration,
      label: '전체 미팅 시간',
    },
    {
      id: 'participants',
      icon: 'users',
      value: `${stats.participantCount}명`,
      label: '참여 인원',
    },
    {
      id: 'languages',
      icon: 'globe',
      value: `${stats.languageCount}개`,
      label: '사용된 언어',
    },
    {
      id: 'transcripts',
      icon: 'captions',
      value: `${stats.transcriptCount}줄`,
      label: '전체 대화 기록',
    },
  ]

  return {
    meetingTitle,
    meetingDate: formatMeetingDate(meetingDate),
    stats: summaryStats,
    highlights: generateMeetingSummary(transcripts),
    actionItems: generateActionItems(transcripts),
  }
}
