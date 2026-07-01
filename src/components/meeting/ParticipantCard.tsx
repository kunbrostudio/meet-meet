import { memo, useEffect, useRef } from 'react'
import meetingCollaboration from '../../assets/landing/meeting-collaboration.jpg'
import meetingSpeaker from '../../assets/landing/meeting-speaker.jpg'
import { getTranslatedText } from '../../fixtures/mockTranscripts'
import type { Participant } from '../../types/participant'
import type { Transcript } from '../../types/transcript'
import type { CaptionSize } from '../../types'
import { Icon } from '../common/Icon'

const languageLabels: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  zh: '中文',
}

type ParticipantCardProps = {
  participant: Participant
  transcript?: Transcript
  targetLanguage: string
  compact?: boolean
  captionSize: CaptionSize
  focusMain?: boolean
  selected?: boolean
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

function ParticipantCardComponent({
  participant,
  transcript,
  targetLanguage,
  compact = false,
  captionSize,
  focusMain = false,
  selected = false,
  onSelect,
  onReconnectMedia,
}: ParticipantCardProps) {
  const imageByParticipant: Partial<Record<number, string>> = {
    1: meetingCollaboration,
    2: meetingSpeaker,
  }
  const isLocal = participant.role === 'local'
  const hasParticipantVideo = Boolean(
    participant.mediaStream?.getVideoTracks().length,
  )
  const image = isLocal || hasParticipantVideo
    ? undefined
    : imageByParticipant[participant.id]
  const isLocalMediaDisconnected =
    isLocal && !participant.mediaStream && participant.isCameraOn

  return (
    <article
      className={[
        'participant-card',
        participant.isSpeaking ? 'speaking' : '',
        compact ? 'is-compact' : '',
        focusMain ? 'is-focus-main' : '',
        selected ? 'is-selected' : '',
        onSelect ? 'is-selectable' : '',
      ].filter(Boolean).join(' ')}
      style={image ? { backgroundImage: `url(${image})` } : { background: participant.avatarColor }}
      data-caption-size={captionSize}
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
      {!image && (!hasParticipantVideo || !participant.isCameraOn) && (
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
      <div className="participant-name">
        <span>{participant.name}{isLocal ? ' (You)' : ''}</span>
        <small>{languageLabels[participant.language] ?? participant.language}</small>
      </div>
      <span className="participant-mic">
        <Icon name={participant.isMicOn ? 'mic' : 'mic-off'} size={13} />
      </span>
      {transcript && (
        <div
          className="participant-subtitle"
          data-translation-source={transcript.translationSource}
          title="실시간 자막"
        >
          <span className="subtitle-original">{transcript.sourceText}</span>
          <span className="subtitle-translated">
            {getTranslatedText(transcript, targetLanguage)}
          </span>
        </div>
      )}
    </article>
  )
}

export const ParticipantCard = memo(
  ParticipantCardComponent,
  (previous, next) => (
    previous.participant.id === next.participant.id
    && previous.participant.liveKitIdentity === next.participant.liveKitIdentity
    && previous.participant.name === next.participant.name
    && previous.participant.language === next.participant.language
    && previous.participant.isCameraOn === next.participant.isCameraOn
    && previous.participant.isMicOn === next.participant.isMicOn
    && previous.participant.isSpeaking === next.participant.isSpeaking
    && previous.participant.mediaStream === next.participant.mediaStream
    && previous.transcript?.id === next.transcript?.id
    && previous.transcript?.translatedText === next.transcript?.translatedText
    && previous.transcript?.sourceText === next.transcript?.sourceText
    && previous.targetLanguage === next.targetLanguage
    && previous.compact === next.compact
    && previous.captionSize === next.captionSize
    && previous.focusMain === next.focusMain
    && previous.selected === next.selected
  ),
)
