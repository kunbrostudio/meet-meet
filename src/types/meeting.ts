import type { LanguageCode } from './transcript'
import type { ChatMessage } from './chat'
import type { Participant } from './participant'
import type { Transcript } from './transcript'
import type { TranslationRecord } from './translation'

export type SummaryStat = {
  id: string
  icon: 'clock' | 'users' | 'globe' | 'captions'
  value: string
  label: string
}

export type SummaryActionItem = {
  text: string
  owner: string
  due: string
}

export type MeetingSummary = {
  meetingTitle: string
  meetingDate: string
  stats: SummaryStat[]
  highlights: string[]
  actionItems: SummaryActionItem[]
}

export type MeetingSession = {
  roomId: string
  roomName: string
  participantCount: number
  startedAt: string
}

export type MeetingPreferences = {
  displayName: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  participantCount: number
  autoStartCaption: boolean
}

export type LocalMediaState = {
  stream: MediaStream | null
  cameraEnabled: boolean
  microphoneEnabled: boolean
}

export type MediaDeviceSelection = {
  videoDeviceId: string
  audioDeviceId: string
  speakerDeviceId?: string
}

export type MeetingMeta = {
  meetingId: string
  roomCode: string
  roomName: string
  meetingRole?: 'host' | 'participant'
  participantCount: number
  createdAt: string
  updatedAt: string
  preferences: MeetingPreferences
}

export type MeetingHistoryItem = {
  meetingId: string
  roomCode: string
  title: string
  createdAt: string
  endedAt: string
  expiresAt?: string
  participantCount: number
  transcriptCount: number
  usedLanguages: LanguageCode[]
}

export type MeetingSessionRecord = {
  meetingId: string
  roomCode: string
  roomName: string
  title: string
  createdAt: string
  startedAt: string
  endedAt?: string
  endedBy?: string
  participants: Participant[]
  chatMessages: ChatMessage[]
  transcripts: Transcript[]
  translations: TranslationRecord[]
  systemMessages: ChatMessage[]
  recordingEnabled?: boolean
  expiresAt?: string
  summaryStatus?: 'draft' | 'ready' | 'exported'
}

export type Room = {
  meetingId: string
  roomCode: string
  title: string
  createdAt: string
  meetingRole: 'host' | 'participant'
  participantIdentity?: string
  hostControlToken?: string
  expiresAt?: string
  maxParticipants?: number
}
