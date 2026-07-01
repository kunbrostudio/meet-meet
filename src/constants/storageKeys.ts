const STORAGE_PREFIX = 'say-merang'

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
  meetingMeta: (meetingId: string) =>
    `${STORAGE_PREFIX}:meeting:${meetingId}:meta`,
} as const
