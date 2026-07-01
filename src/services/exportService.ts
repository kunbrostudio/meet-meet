import type {
  MeetingMeta,
  MeetingSessionRecord,
  MeetingSummary,
} from '../types/meeting'
import type { Transcript } from '../types/transcript'
import type { ChatMessage } from '../types/chat'

type MeetingExportData = {
  roomName: string
  roomCode?: string
  meetingMeta: MeetingMeta | null
  meetingSession?: MeetingSessionRecord | null
  participantCount: number
  summary: MeetingSummary
  transcripts: Transcript[]
  chatMessages: ChatMessage[]
}

const languageNames: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  fr: 'Français',
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getUsedLanguages(transcripts: Transcript[]): string[] {
  const languageCodes = new Set<string>()

  transcripts.forEach((transcript) => {
    languageCodes.add(transcript.sourceLanguage)
    languageCodes.add(transcript.targetLanguage)
  })

  return [...languageCodes].map((code) => languageNames[code] ?? code)
}

function getDuration(summary: MeetingSummary): string {
  return summary.stats.find((stat) => stat.id === 'duration')?.value ?? '-'
}

export function createMeetingMarkdown({
  roomName,
  roomCode,
  meetingMeta,
  meetingSession,
  participantCount,
  summary,
  transcripts,
  chatMessages,
}: MeetingExportData): string {
  const meetingDate =
    meetingSession?.startedAt
    ?? meetingMeta?.createdAt
    ?? transcripts[0]?.createdAt
    ?? new Date().toISOString()
  const endedAt = meetingSession?.endedAt ?? meetingMeta?.updatedAt
  const usedLanguages = getUsedLanguages(transcripts)
  const participantList = meetingSession?.participants.length
    ? meetingSession.participants
        .map((participant) => (
          `- ${participant.name} (${participant.meetingRole}, ${participant.language})`
        ))
        .join('\n')
    : `- 참여자 ${participantCount}명`

  const highlights = summary.highlights
    .map((highlight) => `- ${highlight}`)
    .join('\n')

  const actionItems = summary.actionItems
    .map((item) => `- [ ] ${item.text} — ${item.owner} (${item.due})`)
    .join('\n')

  const conversation = transcripts
    .map((transcript) => {
      const translatedText = transcript.translatedText?.trim()
      const lines = [
        `### ${transcript.time} · ${transcript.speakerName}`,
        '',
        `- 원문 (${languageNames[transcript.sourceLanguage] ?? transcript.sourceLanguage}): ${transcript.sourceText}`,
      ]

      if (translatedText) {
        lines.push(
          `- 번역 (${languageNames[transcript.targetLanguage] ?? transcript.targetLanguage}): ${translatedText}`,
        )
      }

      return lines.join('\n')
    })
    .join('\n\n')
  const chat = chatMessages.length > 0
    ? chatMessages.map((message) => {
        const time = new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(message.createdAt))
        return `- ${time} · **${message.senderName}**: ${message.message}`
      }).join('\n')
    : '- 저장된 채팅 기록이 없습니다.'
  const systemEvents = meetingSession?.systemMessages.length
    ? meetingSession.systemMessages.map((message) => {
        const time = new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(message.createdAt))
        return `- ${time} · ${message.message}`
      }).join('\n')
    : '- 저장된 회의 이벤트가 없습니다.'

  return [
    `# ${roomName}`,
    '',
    '## 회의 정보',
    '',
    `- 방 코드: ${roomCode ?? meetingSession?.roomCode ?? meetingMeta?.roomCode ?? '-'}`,
    `- 회의 날짜/시간: ${formatDateTime(meetingDate)}`,
    `- 시작 시간: ${formatDateTime(meetingDate)}`,
    `- 종료 시간: ${endedAt ? formatDateTime(endedAt) : '-'}`,
    `- 참여자 수: ${participantCount}명`,
    `- 사용된 언어: ${usedLanguages.join(', ') || '-'}`,
    `- 전체 회의 시간: ${getDuration(summary)}`,
    '',
    '## 참가자 목록',
    '',
    participantList,
    '',
    '## 미팅 핵심 요약',
    '',
    highlights,
    '',
    '## 액션 아이템',
    '',
    actionItems,
    '',
    '## 전체 대화 기록',
    '',
    conversation,
    '',
    '## 채팅 기록',
    '',
    chat,
    '',
    '## 회의 이벤트 기록',
    '',
    systemEvents,
    '',
  ].join('\n')
}

export function createMeetingExportFilename(date = new Date()): string {
  const parts = {
    year: date.getFullYear(),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    hour: String(date.getHours()).padStart(2, '0'),
    minute: String(date.getMinutes()).padStart(2, '0'),
  }

  return [
    'say-merang-meeting',
    `${parts.year}-${parts.month}-${parts.day}`,
    `${parts.hour}-${parts.minute}.md`,
  ].join('-')
}

export function downloadMarkdownFile(
  markdown: string,
  filename: string,
): void {
  const blob = new Blob([markdown], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function exportMeetingAsMarkdown(data: MeetingExportData): void {
  const markdown = createMeetingMarkdown(data)
  const filename = createMeetingExportFilename()
  downloadMarkdownFile(markdown, filename)
}
