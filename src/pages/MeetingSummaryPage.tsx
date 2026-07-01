import { useState } from 'react'
import { Icon } from '../components/common/Icon'
import { mockSummary } from '../fixtures/mockSummary'
import { getTranslatedText, mockTranscripts } from '../fixtures/mockTranscripts'
import { exportMeetingAsMarkdown } from '../services/exportService'
import { createTranscriptBasedSummary } from '../services/summaryService'
import {
  loadMeetingMeta,
  loadMeetingTranscripts,
} from '../services/transcriptStorageService'
import type { Participant } from '../types/participant'
import {
  loadChatMessages,
} from '../services/chatService'
import {
  clearMeetingSession,
  dedupeChatMessages,
  dedupeTranscripts,
  loadMeetingSession,
} from '../services/meetingSessionStorageService'

type MeetingSummaryPageProps = {
  meetingId: string
  roomCode: string
  roomName: string
  participants: Participant[]
  targetLanguage: string
  onHome: () => void
  onNewMeeting: () => void
  onDeleteRecord: () => void
  onViewHistory: () => void
}

export function MeetingSummaryPage({
  meetingId,
  roomCode,
  roomName,
  participants,
  targetLanguage,
  onHome,
  onNewMeeting,
  onDeleteRecord,
  onViewHistory,
}: MeetingSummaryPageProps) {
  const currentUser = participants.find(
    (participant) => participant.role === 'local',
  )
  const meetingSession = loadMeetingSession(meetingId)
  const initialStoredTranscripts = loadMeetingTranscripts(meetingId)
  const [chatMessages, setChatMessages] = useState(
    () => dedupeChatMessages(
      meetingSession?.chatMessages ?? loadChatMessages(meetingId),
    ),
  )
  const [systemMessages, setSystemMessages] = useState(
    () => dedupeChatMessages(meetingSession?.systemMessages ?? []),
  )
  const [deleteMessage, setDeleteMessage] = useState('')
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)
  const [hasStoredTranscripts, setHasStoredTranscripts] = useState(
    Boolean(meetingSession?.transcripts.length)
    || initialStoredTranscripts.length > 0,
  )
  const [displayTranscripts, setDisplayTranscripts] = useState(() => {
    if (meetingSession?.transcripts.length) {
      return dedupeTranscripts(meetingSession.transcripts)
    }

    return initialStoredTranscripts.length > 0
      ? dedupeTranscripts(initialStoredTranscripts)
      : dedupeTranscripts(mockTranscripts.map((transcript) => ({
          ...transcript,
          meetingId,
        })))
  })
  const meetingMeta = loadMeetingMeta(meetingId)
  const participantStatFallback = mockSummary.stats.find(
    (stat) => stat.id === 'participants',
  )?.value ?? '4명'
  const effectiveParticipantCount =
    meetingMeta?.participantCount
    ?? meetingSession?.participants.length
    ?? (participants.length > 0 ? participants.length : null)
  const baseSummary = hasStoredTranscripts
    ? createTranscriptBasedSummary(
        roomName,
        meetingMeta?.createdAt ?? mockSummary.meetingDate,
        displayTranscripts,
      )
    : mockSummary
  const displaySummary = {
    ...baseSummary,
    stats: baseSummary.stats.map((stat) => (
      stat.id === 'participants'
        ? {
            ...stat,
            value: effectiveParticipantCount !== null
              ? `${effectiveParticipantCount}명`
              : participantStatFallback,
          }
        : stat
    )),
  }

  const deleteRecord = () => {
    if (isDeletingRecord) {
      return
    }

    const confirmed = window.confirm(
      '이 회의 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
    )

    if (!confirmed) {
      return
    }

    setIsDeletingRecord(true)
    setDeleteMessage('')

    try {
      onDeleteRecord()
      setChatMessages([])
      setSystemMessages([])
      clearMeetingSession(meetingId)
      setHasStoredTranscripts(false)
      setDisplayTranscripts([])
      setDeleteMessage('회의 기록이 삭제되었습니다.')
      window.setTimeout(() => {
        onHome()
      }, 650)
    } catch (error) {
      console.error('[summary] Failed to delete meeting record', error)
      setDeleteMessage('회의 기록을 삭제하지 못했습니다.')
      setIsDeletingRecord(false)
    }
  }

  const exportMeeting = () => {
    if (!hasStoredTranscripts) {
      return
    }

    exportMeetingAsMarkdown({
      roomName,
      roomCode: meetingSession?.roomCode ?? roomCode,
      meetingMeta,
      meetingSession,
      participantCount:
        effectiveParticipantCount
        ?? Number.parseInt(participantStatFallback, 10)
        ?? 4,
      summary: displaySummary,
      transcripts: displayTranscripts,
      chatMessages,
    })
  }

  return (
    <section className="summary-page">
      <div className="container">
        <div className="summary-title">
          <div>
            <h1>미팅이 잘 마무리되었어요</h1>
          <p>{roomName} · {roomCode} · {displaySummary.meetingDate}</p>
          </div>
          <div className="summary-actions">
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={onViewHistory}
            >
              회의 기록 보기
            </button>
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={exportMeeting}
              disabled={!hasStoredTranscripts || isDeletingRecord}
              title={hasStoredTranscripts ? 'Markdown 회의록 다운로드' : '저장된 회의 기록이 없습니다.'}
            >
              <Icon name="download" size={15} /> 내보내기
            </button>
            <button
              className="button button-secondary button-small"
              type="button"
              disabled={isDeletingRecord}
              onClick={deleteRecord}
            >
              {isDeletingRecord ? '삭제 중...' : '기록 삭제'}
            </button>
            <button
              className="button button-primary button-small"
              type="button"
              disabled={isDeletingRecord}
              onClick={onNewMeeting}
            >
              새 미팅
            </button>
          </div>
        </div>

        {deleteMessage && (
          <p
            className={`summary-delete-feedback ${deleteMessage.includes('못했습니다') ? 'is-error' : ''}`}
            role="status"
          >
            {deleteMessage}
          </p>
        )}

        <div className="summary-stats">
          {displaySummary.stats.map((stat) => (
            <div className="stat-card" key={stat.id}>
              <span className="stat-icon"><Icon name={stat.icon} size={18} /></span>
              <div><strong>{stat.value}</strong><span>{stat.label}</span></div>
            </div>
          ))}
        </div>

        <div className="summary-grid">
          <article className="summary-card">
            <h2><Icon name="sparkles" size={18} /> 미팅 핵심 요약</h2>
            <ul className="highlight-list">
              {displaySummary.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </article>

          <article className="summary-card">
            <h2><Icon name="check" size={18} /> 액션 아이템</h2>
            <div className="action-list">
              {displaySummary.actionItems.map((item) => (
                <div className="action-item" key={item.text}>
                  <span className="action-check" />
                  <div>
                    <p>{item.text}</p>
                    <span className="action-owner">
                      {item.owner === 'Ken Choi' ? currentUser?.name ?? item.owner : item.owner}
                    </span>
                  </div>
                  <span className="action-due">{item.due}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="summary-card full-transcript">
            <h2><Icon name="captions" size={18} /> 전체 대화 기록</h2>
            <div className="summary-transcript">
              {displayTranscripts.map((item) => {
                const participant = participants.find(
                  (person) => person.id === item.participantId,
                )
                return (
                  <div className="summary-transcript-row" key={item.id}>
                    <time>{item.time}</time>
                    <strong>{participant?.name ?? item.speakerName}</strong>
                    <p>{getTranslatedText(item, targetLanguage)}</p>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="summary-card full-transcript">
            <h2><Icon name="message" size={18} /> 채팅 기록</h2>
            {chatMessages.length === 0 ? (
              <p className="summary-chat-empty">저장된 채팅 기록이 없습니다.</p>
            ) : (
              <div className="summary-chat-list">
                {chatMessages.map((message) => (
                  <div className="summary-chat-row" key={message.id}>
                    <time>
                      {new Intl.DateTimeFormat('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }).format(new Date(message.createdAt))}
                    </time>
                    <strong>{message.senderName}</strong>
                    <p>{message.message}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="summary-card full-transcript">
            <h2><Icon name="users" size={18} /> 회의 이벤트 기록</h2>
            {systemMessages.length === 0 ? (
              <p className="summary-chat-empty">저장된 시스템 이벤트가 없습니다.</p>
            ) : (
              <div className="summary-chat-list">
                {systemMessages.map((message) => (
                  <div className="summary-chat-row" key={message.id}>
                    <time>
                      {new Intl.DateTimeFormat('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }).format(new Date(message.createdAt))}
                    </time>
                    <strong>{message.senderName}</strong>
                    <p>{message.message}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <button className="back-link" type="button" onClick={onHome}><Icon name="arrow-left" size={14} /> 홈으로 돌아가기</button>
      </div>
    </section>
  )
}
