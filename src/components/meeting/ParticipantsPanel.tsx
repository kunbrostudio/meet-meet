import type { LanguageCode, Participant } from '../../types'
import { Icon } from '../common/Icon'

const languageLabels: Record<LanguageCode, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  fr: 'Français',
}

type ParticipantsPanelProps = {
  participants: Participant[]
  onClose: () => void
  onRequestRemove: (participant: Participant) => void
  allowRemove?: boolean
  message?: string
}

export function ParticipantsPanel({
  participants,
  onClose,
  onRequestRemove,
  allowRemove = true,
  message,
}: ParticipantsPanelProps) {
  const currentParticipant = participants.find(
    (participant) => participant.role === 'local',
  )
  const canManageParticipants =
    allowRemove && currentParticipant?.meetingRole === 'host'

  return (
    <div className="meeting-settings-backdrop" onMouseDown={onClose}>
      <aside
        className="meeting-settings-panel participants-panel"
        aria-label="참가자 목록"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="meeting-settings-header">
          <div>
            <span>IN THIS MEETING</span>
            <h2>참가자 <small>{participants.length}명</small></h2>
          </div>
          <button type="button" onClick={onClose}>닫기</button>
        </div>

        <div className="participant-list">
          {message && (
            <p
              className={`participants-panel-message ${message.includes('못했습니다') ? 'is-error' : ''}`}
              role="status"
            >
              {message}
            </p>
          )}
          {participants.map((participant) => (
            <article
              className={`participant-list-item ${participant.isSpeaking ? 'is-speaking' : ''}`}
              key={participant.id}
            >
              <span
                className="participant-list-avatar"
                style={{ background: participant.avatarColor }}
              >
                {participant.avatarLabel}
              </span>
              <div className="participant-list-copy">
                <div>
                  <strong>{participant.name}</strong>
                  {participant.role === 'local' && <em>나</em>}
                  {participant.meetingRole === 'host' && (
                    <em className="participant-host-badge">방장</em>
                  )}
                  {participant.isSpeaking && <b>말하는 중</b>}
                </div>
                <span>{languageLabels[participant.language]}</span>
              </div>
              <div className="participant-list-media">
                <MediaStatus
                  enabled={participant.isMicOn}
                  onIcon="mic"
                  offIcon="mic-off"
                  label="마이크"
                />
                <MediaStatus
                  enabled={participant.isCameraOn}
                  onIcon="video"
                  offIcon="video-off"
                  label="카메라"
                />
                {canManageParticipants && participant.role === 'remote' && (
                  <button
                    type="button"
                    className="participant-remove-button"
                    onClick={() => onRequestRemove(participant)}
                  >
                    내보내기
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  )
}

type MediaStatusProps = {
  enabled: boolean
  onIcon: 'mic' | 'video'
  offIcon: 'mic-off' | 'video-off'
  label: string
}

function MediaStatus({
  enabled,
  onIcon,
  offIcon,
  label,
}: MediaStatusProps) {
  return (
    <span
      className={enabled ? 'is-on' : 'is-off'}
      title={`${label} ${enabled ? '켜짐' : '꺼짐'}`}
    >
      <Icon name={enabled ? onIcon : offIcon} size={14} />
    </span>
  )
}
