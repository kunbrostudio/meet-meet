import { useState } from 'react'
import { Icon } from '../components/common/Icon'
import { ENABLE_MOCK_DATA } from '../constants/mockData'
import { TRANSLATION_MODE_CONFIG } from '../constants/translationMode'
import { mockSummary } from '../fixtures/mockSummary'
import { mockTranscripts } from '../fixtures/mockTranscripts'
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
import {
  createManualTranslation,
  clearTranslations,
  dedupeTranslations,
  findTranslation,
  getTranslationCacheKey,
  loadTranslations,
  saveTranslations,
} from '../services/translationRecordService'
import type {
  TranslationRecord,
  TranslationSourceType,
} from '../types/translation'
import type { LanguageCode } from '../types'

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

const lockedTranslationMessage =
  '회의록 번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.'

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
  const [translations, setTranslations] = useState<TranslationRecord[]>(
    () => dedupeTranslations([
      ...(meetingSession?.translations ?? []),
      ...loadTranslations(meetingId),
    ]),
  )
  const [translationTargetLanguage, setTranslationTargetLanguage] =
    useState<LanguageCode>(
      targetLanguage === 'ko' || targetLanguage === 'en'
        ? targetLanguage
        : 'en',
    )
  const [translatingKeys, setTranslatingKeys] = useState<string[]>([])
  const [deleteMessage, setDeleteMessage] = useState('')
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)
  const [displayTranscripts, setDisplayTranscripts] = useState(() => {
    if (meetingSession?.transcripts.length) {
      return dedupeTranscripts(meetingSession.transcripts)
    }

    if (initialStoredTranscripts.length > 0) {
      return dedupeTranscripts(initialStoredTranscripts)
    }

    return ENABLE_MOCK_DATA
      ? dedupeTranscripts(mockTranscripts.map((transcript) => ({
          ...transcript,
          meetingId,
        })))
      : []
  })
  const meetingMeta = loadMeetingMeta(meetingId)
  const hasMeetingRecords =
    displayTranscripts.length > 0
    || chatMessages.length > 0
    || systemMessages.length > 0
  const effectiveParticipantCount =
    meetingMeta?.participantCount
    ?? meetingSession?.participants.length
    ?? (participants.length > 0 ? participants.length : null)
  const baseSummary = (
    displayTranscripts.length > 0 || !ENABLE_MOCK_DATA
  )
    ? createTranscriptBasedSummary(
        roomName,
        meetingMeta?.createdAt
          ?? meetingSession?.createdAt
          ?? new Date().toISOString(),
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
              : stat.value,
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
      clearTranslations(meetingId)
      clearMeetingSession(meetingId)
      setDisplayTranscripts([])
      setTranslations([])
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
    if (!hasMeetingRecords) {
      return
    }

    exportMeetingAsMarkdown({
      roomName,
      roomCode: meetingSession?.roomCode ?? roomCode,
      meetingMeta,
      meetingSession,
      participantCount:
        effectiveParticipantCount
        ?? participants.length
        ?? 4,
      summary: displaySummary,
      transcripts: displayTranscripts,
      chatMessages,
      translations,
    })
  }

  const translateSummaryItem = async (
    sourceType: TranslationSourceType,
    sourceId: string,
    sourceText: string,
    sourceLanguage: LanguageCode,
  ) => {
    if (!TRANSLATION_MODE_CONFIG.canUseManualTranslation) {
      setDeleteMessage(lockedTranslationMessage)
      return
    }

    const target =
      sourceLanguage === 'ko'
        ? 'en'
        : sourceLanguage === 'en'
          ? 'ko'
          : translationTargetLanguage
    const cacheKey = getTranslationCacheKey(sourceType, sourceId, target)
    const existingTranslation = findTranslation(
      translations,
      sourceType,
      sourceId,
      target,
    )

    if (existingTranslation?.status === 'success') {
      return
    }

    setTranslatingKeys((current) => (
      current.includes(cacheKey) ? current : [...current, cacheKey]
    ))

    try {
      const translation = await createManualTranslation({
        roomCode: meetingSession?.roomCode ?? roomCode,
        sourceType,
        sourceId,
        sourceText,
        sourceLanguage,
        targetLanguage: target,
      })
      const nextTranslations = dedupeTranslations([
        ...translations.filter((item) => !(
          item.sourceType === sourceType
          && item.sourceId === sourceId
          && item.targetLanguage === target
        )),
        translation,
      ])
      setTranslations(nextTranslations)
      saveTranslations(meetingId, nextTranslations)
    } catch (error) {
      console.warn('[summary] Failed to translate item', error)
      setDeleteMessage('번역에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setTranslatingKeys((current) => (
        current.filter((item) => item !== cacheKey)
      ))
    }
  }

  const renderTranslation = (
    sourceType: TranslationSourceType,
    sourceId: string,
    sourceText: string,
    sourceLanguage: LanguageCode,
  ) => {
    const effectiveTargetLanguage =
      sourceLanguage === 'ko'
        ? 'en'
        : sourceLanguage === 'en'
          ? 'ko'
          : translationTargetLanguage
    const translation = findTranslation(
      translations,
      sourceType,
      sourceId,
      effectiveTargetLanguage,
    )
    const key = getTranslationCacheKey(
      sourceType,
      sourceId,
      effectiveTargetLanguage,
    )
    const isLoading = translatingKeys.includes(key)
    const isFailed = translation?.status === 'failed'
    const isSuccess = translation?.status === 'success'
    const canUseManualTranslation = TRANSLATION_MODE_CONFIG.canUseManualTranslation
    const showLockedTranslation = !canUseManualTranslation && !isSuccess

    return (
      <div className="summary-translation">
        {canUseManualTranslation && isLoading && (
          <p className="translation-loading">번역 중...</p>
        )}
        {isSuccess && (
          <p className="translation-result">
            <span>{translation.targetLanguage.toUpperCase()}</span>
            {translation.translatedText}
          </p>
        )}
        {canUseManualTranslation && isFailed && (
          <>
            <p className="translation-failed">번역에 실패했습니다.</p>
            <button
              className="translation-button"
              type="button"
              disabled={isLoading || !sourceText.trim()}
              onClick={() => void translateSummaryItem(
                sourceType,
                sourceId,
                sourceText,
                sourceLanguage,
              )}
            >
              다시 시도
            </button>
          </>
        )}
        {!isSuccess && !isFailed && canUseManualTranslation && (
          <button
            className="translation-button"
            type="button"
            disabled={isLoading || !sourceText.trim()}
            onClick={() => void translateSummaryItem(
              sourceType,
              sourceId,
              sourceText,
              sourceLanguage,
            )}
          >
            번역하기
          </button>
        )}
        {showLockedTranslation && (
          <button
            className="translation-button is-locked"
            type="button"
            onClick={() => setDeleteMessage(lockedTranslationMessage)}
            aria-label="잠긴 번역 기능 안내 보기"
          >
            <Icon name="lock" size={12} /> 번역하기
          </button>
        )}
      </div>
    )
  }

  const detectSummaryChatLanguage = (message: string): LanguageCode => {
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message)) {
      return 'ko'
    }
    if (/[A-Za-z]/.test(message)) {
      return 'en'
    }
    return 'en'
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
              disabled={!hasMeetingRecords || isDeletingRecord}
              title={hasMeetingRecords ? 'Markdown 회의록 다운로드' : '저장된 회의 기록이 없습니다.'}
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

        <div className="local-recording-notice">
          <strong>이 회의 기록은 현재 사용 중인 브라우저에만 임시 저장됩니다.</strong>
          <span>보관이 필요한 경우 3일 이내에 Markdown 파일로 다운로드해 주세요. 브라우저 설정, 시크릿 모드, 캐시 삭제, 저장 공간 부족 등에 따라 기록이 더 빨리 사라질 수 있습니다.</span>
          <label>
            번역 언어
            <select
              value={translationTargetLanguage}
              onMouseDown={(event) => {
                if (!TRANSLATION_MODE_CONFIG.canUseManualTranslation) {
                  event.preventDefault()
                  setDeleteMessage(lockedTranslationMessage)
                }
              }}
              onKeyDown={(event) => {
                if (!TRANSLATION_MODE_CONFIG.canUseManualTranslation) {
                  event.preventDefault()
                  setDeleteMessage(lockedTranslationMessage)
                }
              }}
              onChange={(event) => {
                if (!TRANSLATION_MODE_CONFIG.canUseManualTranslation) {
                  setDeleteMessage(lockedTranslationMessage)
                  return
                }
                setTranslationTargetLanguage(
                  event.target.value as LanguageCode,
                )
              }}
              aria-disabled={!TRANSLATION_MODE_CONFIG.canUseManualTranslation}
              className={!TRANSLATION_MODE_CONFIG.canUseManualTranslation ? 'is-locked' : ''}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
          {!TRANSLATION_MODE_CONFIG.canUseManualTranslation && (
            <button
              className="translation-lock-chip"
              type="button"
              onClick={() => setDeleteMessage(lockedTranslationMessage)}
            >
              <Icon name="lock" size={11} />
            </button>
          )}
        </div>

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
            {displayTranscripts.length === 0 ? (
              <div className="summary-empty-state">
                <strong>아직 요약할 대화 기록이 없습니다.</strong>
                <p>채팅이나 자막 기록이 있는 회의는 종료 후 이곳에 요약이 표시됩니다.</p>
              </div>
            ) : (
              <ul className="highlight-list">
                {displaySummary.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
          </article>

          <article className="summary-card">
            <h2><Icon name="check" size={18} /> 액션 아이템</h2>
            {displayTranscripts.length === 0 ? (
              <p className="summary-chat-empty">감지된 액션 아이템이 없습니다.</p>
            ) : (
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
            )}
          </article>

          <article className="summary-card full-transcript">
            <h2><Icon name="captions" size={18} /> 전체 대화 기록</h2>
            {displayTranscripts.length === 0 ? (
              <p className="summary-chat-empty">저장된 자막 기록이 없습니다.</p>
            ) : (
              <div className="summary-transcript">
                {displayTranscripts.map((item) => {
                  const participant = participants.find(
                    (person) => person.id === item.participantId,
                  )
                  return (
                    <div className="summary-transcript-row" key={item.id}>
                      <time>{item.time}</time>
                      <strong>{participant?.name ?? item.speakerName}</strong>
                      <div className="summary-record-content">
                        <p>{item.sourceText}</p>
                        {renderTranslation(
                          'transcript',
                          item.transcriptId ?? String(item.id),
                          item.sourceText,
                          item.sourceLanguage,
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
                    <div className="summary-record-content">
                      <p>{message.message}</p>
                      {message.type === 'user' && renderTranslation(
                        'chat',
                        message.id,
                        message.message,
                        detectSummaryChatLanguage(message.message),
                      )}
                    </div>
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
