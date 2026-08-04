import { memo, useEffect, useRef } from 'react'
import type { Participant } from '../../types/participant'
import { Icon } from '../common/Icon'

type ParticipantGameCardProps = {
  participant: Participant
  selected?: boolean
  isReady?: boolean
  gameRole?: 'attacker' | 'defender'
  isAttackActive?: boolean
  onSelect?: () => void
  onReconnectMedia?: () => void
}

type ParticipantVideoProps = {
  stream: MediaStream
  isLocal: boolean
  participantIdentity: string
}

const ParticipantVideo = memo(
  function ParticipantVideo({
    stream,
    isLocal,
  }: ParticipantVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      const video = videoRef.current

      if (!video) {
        return
      }

      if (video.srcObject !== stream) {
        video.srcObject = stream
      }

      void video.play().catch(() => undefined)
    }, [stream])

    return (
      <video
        ref={videoRef}
        className={`participant-video ${isLocal ? 'is-local' : 'is-remote'}`}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(event) => {
          void event.currentTarget.play().catch(() => undefined)
        }}
      />
    )
  },
  (previous, next) => (
    previous.stream === next.stream
    && previous.isLocal === next.isLocal
    && previous.participantIdentity === next.participantIdentity
  ),
)

function ParticipantGameCardComponent({
  participant,
  selected = false,
  isReady = false,
  gameRole,
  isAttackActive = false,
  onSelect,
  onReconnectMedia,
}: ParticipantGameCardProps) {
  const isLocal = participant.role === 'local'
  const hasParticipantVideo = Boolean(
    participant.mediaStream?.getVideoTracks().length,
  )
  const isLocalMediaDisconnected =
    isLocal && !participant.mediaStream && participant.isCameraOn

  return (
    <article
      className={[
        'participant-game-card',
        participant.isSpeaking ? 'speaking' : '',
        selected ? 'is-selected' : '',
        onSelect ? 'is-selectable' : '',
        gameRole === 'attacker' ? 'is-attacker' : '',
        gameRole === 'defender' ? 'is-defender' : '',
        gameRole === 'attacker' && isAttackActive ? 'is-active-attacker' : '',
      ].filter(Boolean).join(' ')}
      style={{ background: participant.avatarColor }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onSelect()
        }
      }}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      {participant.mediaStream && hasParticipantVideo && participant.isCameraOn && (
        <ParticipantVideo
          stream={participant.mediaStream}
          isLocal={isLocal}
          participantIdentity={participant.liveKitIdentity ?? String(participant.id)}
        />
      )}
      {(!hasParticipantVideo || !participant.isCameraOn) && (
        <div className="participant-placeholder">
          {isLocalMediaDisconnected ? (
            <div className="media-disconnected-notice">
              <Icon name="video-off" size={30} />
              <p>카메라 연결이 끊겼습니다.<br />설정 화면에서 다시 연결해주세요.</p>
              <button type="button" onClick={onReconnectMedia}>
                설정으로 돌아가기
              </button>
            </div>
          ) : isLocal && !participant.isCameraOn ? (
            <>
              <div className="participant-avatar">{participant.avatarLabel}</div>
              <p className="participant-camera-off-copy">
                카메라가 꺼져 있습니다.
              </p>
            </>
          ) : (
            <div className="participant-avatar">{participant.avatarLabel}</div>
          )}
        </div>
      )}
      <div className="participant-card-shade" />
      <div className="participant-game-overlay">
        <div className="participant-game-name">
          <span>{participant.name}</span>
          {isLocal && <small>나</small>}
          {participant.meetingRole === 'host' && <small>HOST</small>}
        </div>
        <span
          className={`participant-game-mic ${participant.isMicOn ? '' : 'is-off'}`}
          aria-label={participant.isMicOn ? '마이크 켜짐' : '마이크 꺼짐'}
          title={participant.isMicOn ? '마이크 켜짐' : '마이크 꺼짐'}
        >
          <Icon name={participant.isMicOn ? 'mic' : 'mic-off'} size={13} />
        </span>
      </div>
      <div className="participant-game-status-slot" aria-hidden="true">
        {gameRole === 'attacker' ? (
          <span className="participant-role-badge is-attacker">
            {isAttackActive ? 'ACTIVE ATTACK' : 'ATTACKER'}
          </span>
        ) : gameRole === 'defender' ? (
          <span className="participant-role-badge is-defender">
            {isAttackActive ? '버티는 중' : 'DEFENDER'}
          </span>
        ) : isReady && (
          <span className="participant-ready-badge">READY</span>
        )}
      </div>
    </article>
  )
}

export const ParticipantGameCard = memo(
  ParticipantGameCardComponent,
  (previous, next) => (
    previous.participant.id === next.participant.id
    && previous.participant.liveKitIdentity === next.participant.liveKitIdentity
    && previous.participant.name === next.participant.name
    && previous.participant.isCameraOn === next.participant.isCameraOn
    && previous.participant.isMicOn === next.participant.isMicOn
    && previous.participant.isSpeaking === next.participant.isSpeaking
    && previous.participant.mediaStream === next.participant.mediaStream
    && previous.participant.cameraTrackSid === next.participant.cameraTrackSid
    && previous.participant.cameraTrackId === next.participant.cameraTrackId
    && previous.participant.microphoneTrackSid === next.participant.microphoneTrackSid
    && previous.participant.microphoneTrackId === next.participant.microphoneTrackId
    && previous.selected === next.selected
    && previous.isReady === next.isReady
    && previous.gameRole === next.gameRole
    && previous.isAttackActive === next.isAttackActive
  ),
)
