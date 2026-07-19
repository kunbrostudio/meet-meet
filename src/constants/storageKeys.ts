const STORAGE_PREFIX = 'meet-meet'

export const STORAGE_KEYS = {
  activeMeeting: `${STORAGE_PREFIX}:active-meeting`,
  captionPreferences: `${STORAGE_PREFIX}:caption-preferences`,
  currentRoom: `${STORAGE_PREFIX}:current-room`,
  meetingHistory: `${STORAGE_PREFIX}:meeting-history`,
  meetingSession: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}`,
  meetingTranscripts: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}:transcripts`,
  meetingChat: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}:chat`,
  meetingTranslations: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}:translations`,
  meetingMeta: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}:meta`,
} as const
