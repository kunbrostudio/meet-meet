import { useState } from 'react'
import { Icon } from '../components/common/Icon'
import {
  clearMeetingMeta,
  clearMeetingTranscripts,
  deleteMeetingHistoryItem,
  loadMeetingHistory,
} from '../services/transcriptStorageService'
import type { MeetingHistoryItem } from '../types/meeting'
import { clearChatMessages } from '../services/chatService'
import { clearMeetingSession } from '../services/meetingSessionStorageService'

type MeetingHistoryPageProps = {
  onBack: () => void
  onHome: () => void
  onOpenMeeting: (meetingId: string) => void
}

const languageLabels: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  fr: 'Français',
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function MeetingHistoryPage({
  onBack,
  onHome,
  onOpenMeeting,
}: MeetingHistoryPageProps) {
  const [history, setHistory] = useState<MeetingHistoryItem[]>(
    loadMeetingHistory,
  )
  const [message, setMessage] = useState('')
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null)

  const deleteHistoryItem = (meetingId: string) => {
    if (deletingMeetingId) {
      return
    }

    const confirmed = window.confirm(
      '이 회의 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
    )

    if (!confirmed) {
      return
    }

    setDeletingMeetingId(meetingId)
    setMessage('')

    try {
      clearMeetingTranscripts(meetingId)
      clearChatMessages(meetingId)
      clearMeetingSession(meetingId)
      clearMeetingMeta(meetingId)
      deleteMeetingHistoryItem(meetingId)
      setHistory((current) => current.filter(
        (item) => item.meetingId !== meetingId,
      ))
      setMessage('회의 기록이 삭제되었습니다.')
    } catch (error) {
      console.error('[history] Failed to delete meeting record', error)
      setMessage('회의 기록을 삭제하지 못했습니다.')
    } finally {
      setDeletingMeetingId(null)
    }
  }

  return (
    <section className="history-page">
      <div className="container">
        <div className="history-heading">
          <div>
            <span className="history-eyebrow">MEETING ARCHIVE</span>
            <h1>회의 기록</h1>
            <p>이전에 저장한 회의와 대화 기록을 다시 확인하세요.</p>
          </div>
          <div className="history-heading-actions">
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={onBack}
            >
              <Icon name="arrow-left" size={15} /> 이전으로
            </button>
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={onHome}
            >
              홈으로
            </button>
          </div>
        </div>

        {message && (
          <p
            className={`history-feedback ${message.includes('못했습니다') ? 'is-error' : ''}`}
            role="status"
          >
            {message}
          </p>
        )}

        {history.length === 0 ? (
          <div className="history-empty">
            <span><Icon name="summary" size={24} /></span>
            <h2>저장된 회의 기록이 없습니다.</h2>
            <p>미팅을 마치면 회의 기록이 이곳에 저장됩니다.</p>
          </div>
        ) : (
          <div className="history-grid">
            {history.map((item) => (
              <article className="history-card" key={item.meetingId}>
                <div className="history-card-top">
                  <span className="history-card-icon">
                    <Icon name="captions" size={18} />
                  </span>
                  <time>{formatHistoryDate(item.endedAt)}</time>
                </div>
                <h2>{item.title}</h2>
                <span className="history-room-code">
                  {item.roomCode || 'MER-LOCAL'}
                </span>
                <div className="history-meta-grid">
                  <span><Icon name="users" size={14} /> {item.participantCount}명</span>
                  <span><Icon name="captions" size={14} /> {item.transcriptCount}개 기록</span>
                  <span className="history-languages">
                    <Icon name="globe" size={14} />
                    {item.usedLanguages.map(
                      (language) => languageLabels[language] ?? language,
                    ).join(', ')}
                  </span>
                </div>
                <div className="history-card-actions">
                  <button
                    className="button button-primary button-small"
                    type="button"
                    onClick={() => onOpenMeeting(item.meetingId)}
                  >
                    열기 <Icon name="arrow-right" size={14} />
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    disabled={deletingMeetingId === item.meetingId}
                    onClick={() => deleteHistoryItem(item.meetingId)}
                  >
                    {deletingMeetingId === item.meetingId ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
