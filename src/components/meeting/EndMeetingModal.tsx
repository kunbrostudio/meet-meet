import { Icon } from '../common/Icon'

type EndMeetingModalProps = {
  isSaving: boolean
  title?: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  savingLabel?: string
  onContinue: () => void
  onConfirm: () => void
}

export function EndMeetingModal({
  isSaving,
  title = '방을 종료할까요?',
  description = '종료하면 모든 참가자가 방에서 나가고 홈으로 이동합니다.',
  cancelLabel = '계속하기',
  confirmLabel = '방 종료',
  savingLabel = '저장 중...',
  onContinue,
  onConfirm,
}: EndMeetingModalProps) {
  return (
    <div
      className="meeting-end-backdrop"
      onMouseDown={() => {
        if (!isSaving) {
          onContinue()
        }
      }}
    >
      <div
        className="meeting-end-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-end-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="meeting-end-icon">
          <Icon name="phone" size={20} />
        </span>
        <h2 id="meeting-end-title">{title}</h2>
        <p>{description}</p>
        <div className="meeting-end-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onContinue}
            disabled={isSaving}
          >
            {cancelLabel}
          </button>
          <button
            className="button meeting-end-confirm"
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? savingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
