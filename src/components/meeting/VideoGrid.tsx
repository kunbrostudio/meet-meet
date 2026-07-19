import type { Participant } from '../../types/participant'
import { ParticipantCard } from './ParticipantCard'

type VideoGridProps = {
  participants: Participant[]
  compact?: boolean
  viewMode?: 'grid' | 'focus'
  selectedParticipantId?: number
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia: () => void
}

export function VideoGrid({
  participants,
  compact = false,
  viewMode = 'grid',
  selectedParticipantId,
  onSelectParticipant,
  onReconnectMedia,
}: VideoGridProps) {
  const renderParticipant = (
    participant: Participant,
    isCompact = compact,
    focusMain = false,
  ) => (
    <ParticipantCard
      key={participant.liveKitIdentity ?? participant.id}
      participant={participant}
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
