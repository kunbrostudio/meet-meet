import type { Participant } from '../../types'

type RemoveParticipantModalProps = {
  participant: Participant
  isRemoving?: boolean
  message?: string
  onCancel: () => void
  onConfirm: () => void
}

export function RemoveParticipantModal({
  participant,
  isRemoving = false,
  message,
  onCancel,
  onConfirm,
}: RemoveParticipantModalProps) {
  return (
    <div
      className="meeting-end-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isRemoving) {
          onCancel()
        }
      }}
    >
      <section
        className="meeting-end-modal participant-remove-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-participant-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="participant-remove-avatar">
          {participant.avatarLabel}
        </span>
        <h2 id="remove-participant-title">참가자를 내보낼까요?</h2>
        <p>
          선택한 참가자는 현재 방에서 퇴장됩니다.
          <strong>{participant.name}</strong>
        </p>
        {message && (
          <p className="participant-remove-message" role="alert">
            {message}
          </p>
        )}
        <div className="meeting-end-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={isRemoving}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="button participant-remove-confirm"
            disabled={isRemoving}
            onClick={onConfirm}
          >
            {isRemoving ? '내보내는 중...' : '내보내기'}
          </button>
        </div>
      </section>
    </div>
  )
}
