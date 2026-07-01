import { useMemo } from 'react'
import type { Participant } from '../../types/participant'
import type { Transcript } from '../../types/transcript'
import { ParticipantCard } from './ParticipantCard'
import type { CaptionSize } from '../../types'

type VideoGridProps = {
  participants: Participant[]
  transcripts: Transcript[]
  targetLanguage: string
  captionSize: CaptionSize
  compact?: boolean
  viewMode?: 'grid' | 'focus'
  selectedParticipantId?: number
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia: () => void
}

export function VideoGrid({
  participants,
  transcripts,
  targetLanguage,
  captionSize,
  compact = false,
  viewMode = 'grid',
  selectedParticipantId,
  onSelectParticipant,
  onReconnectMedia,
}: VideoGridProps) {
  const latestTranscriptByParticipant = useMemo(() => {
    const map = new Map<number, Transcript>()

    for (const transcript of transcripts) {
      map.set(transcript.participantId, transcript)
    }

    return map
  }, [transcripts])

  const renderParticipant = (
    participant: Participant,
    isCompact = compact,
    focusMain = false,
  ) => (
    <ParticipantCard
      key={participant.liveKitIdentity ?? participant.id}
      participant={participant}
      transcript={latestTranscriptByParticipant.get(participant.id)}
      targetLanguage={targetLanguage}
      captionSize={captionSize}
      compact={isCompact}
      focusMain={focusMain}
      selected={participant.id === selectedParticipantId}
      onSelect={
        onSelectParticipant
          ? () => onSelectParticipant(participant.id)
          : undefined
      }
      onReconnectMedia={
        participant.role === 'local' ? onReconnectMedia : undefined
      }
    />
  )

  if (!compact && viewMode === 'focus') {
    const selectedParticipant =
      participants.find((participant) => participant.id === selectedParticipantId)
      ?? participants[0]
    const thumbnailParticipants = participants.filter(
      (participant) => participant.id !== selectedParticipant?.id,
    )

    return (
      <div className="focus-layout">
        <div className="focus-main">
          {selectedParticipant && renderParticipant(selectedParticipant, false, true)}
        </div>
        <div className="focus-thumbnails">
          {thumbnailParticipants.map((participant) => (
            renderParticipant(participant, true)
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`video-grid ${compact ? 'is-compact-strip' : ''}`}
      data-participant-count={participants.length}
    >
      {participants.map((participant) => renderParticipant(participant))}
    </div>
  )
}
