import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../types/chat'
import type { GameTimelineEvent } from '../../types/game'
import { Icon } from '../common/Icon'
import { downloadAttackContentBlob } from '../../services/attackContentService'
import { GameBoardEmptyState } from './GameBoardEmptyState'

type GameChatPanelProps = {
  messages: ChatMessage[]
  timelineEvents?: GameTimelineEvent[]
  localParticipantId?: number
  onSendMessage: (message: string) => void | Promise<void>
  canSendMessage?: boolean
  sendMessage?: string
}

type TimelineViewItem =
  | {
      kind: 'chat'
      id: string
      timestamp: string
      chatMessage: ChatMessage
    }
  | {
      kind: 'attack'
      id: string
      timestamp: string
      attack?: Extract<GameTimelineEvent, { type: 'attack' }>
      result?: Extract<GameTimelineEvent, { type: 'attack-result' }>
    }
  | {
      kind: 'game'
      id: string
      timestamp: string
      gameEvent: Exclude<
        GameTimelineEvent,
        { type: 'attack' } | { type: 'attack-result' }
      >
    }

export function GameChatPanel({
  messages,
  timelineEvents = [],
  localParticipantId,
  onSendMessage,
  canSendMessage = true,
  sendMessage = '',
}: GameChatPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const wasNearBottomRef = useRef(true)
  const isComposingRef = useRef(false)

  const timelineItems = useMemo<TimelineViewItem[]>(() => {
    const attackItems = new Map<string, Extract<TimelineViewItem, { kind: 'attack' }>>()
    const eliminatedInAttackResults = new Set(
      timelineEvents.flatMap((event) => (
        event.type === 'attack-result'
          ? event.defenderResults
            ?.filter((defender) => defender.eliminated)
            .map((defender) => defender.participantIdentity)
            ?? []
          : []
      )),
    )
    const items: TimelineViewItem[] = messages.map((message) => ({
      kind: 'chat',
      id: `chat:${message.id}`,
      timestamp: message.createdAt,
      chatMessage: message,
    }))

    timelineEvents.forEach((event) => {
      if (event.type === 'attack' || event.type === 'attack-result') {
        const existing = attackItems.get(event.attackId)
        const nextItem: Extract<TimelineViewItem, { kind: 'attack' }> = {
          kind: 'attack',
          id: `attack:${event.attackId}`,
          timestamp: existing
            ? (
                Date.parse(existing.timestamp) <= Date.parse(event.timestamp)
                  ? existing.timestamp
                  : event.timestamp
              )
            : event.timestamp,
          attack: event.type === 'attack' ? event : existing?.attack,
          result: event.type === 'attack-result' ? event : existing?.result,
        }

        attackItems.set(event.attackId, nextItem)
        return
      }

      if (
        event.type === 'elimination'
        && eliminatedInAttackResults.has(event.participantIdentity)
      ) {
        return
      }

      items.push({
        kind: 'game',
        id: `game:${event.id}`,
        timestamp: event.timestamp,
        gameEvent: event,
      })
    })

    return [...items, ...attackItems.values()].sort((left, right) => (
      Date.parse(left.timestamp) - Date.parse(right.timestamp)
    ))
  }, [messages, timelineEvents])

  useEffect(() => {
    const list = listRef.current

    if (list && wasNearBottomRef.current) {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [timelineItems.length])

  const handleScroll = () => {
    const list = listRef.current

    if (!list) {
      return
    }

    wasNearBottomRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80
  }

  const sendChatMessage = async () => {
    const message = chatInput.trim()

    if (!message || !canSendMessage || isSending) {
      return
    }

    setIsSending(true)
    try {
      await onSendMessage(message)
      setChatInput('')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="game-chat-panel" aria-label="GAME ROOM TIMELINE">
      <div className="game-chat-list" ref={listRef} onScroll={handleScroll}>
        {timelineItems.length === 0 ? (
          <GameBoardEmptyState />
        ) : timelineItems.map((item) => {
          if (item.kind === 'attack') {
            return (
              <AttackTimelineCard
                attack={item.attack}
                result={item.result}
                key={item.id}
              />
            )
          }

          if (item.kind === 'game') {
            return (
              <GameTimelineCard
                event={item.gameEvent}
                key={item.id}
              />
            )
          }

          const chatMessage = item.chatMessage
          const isMine = chatMessage.type === 'user'
            && chatMessage.senderId === localParticipantId
          const time = new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(chatMessage.createdAt))

          return (
            <div
              className={`chat-message ${isMine ? 'is-mine' : ''} ${chatMessage.type === 'system' ? 'is-system' : ''}`}
              key={chatMessage.id}
            >
              <div className="chat-message-meta">
                <strong>{chatMessage.senderName}</strong>
                <time>{time}</time>
              </div>
              <p>{chatMessage.message}</p>
            </div>
          )
        })}
      </div>

      <div className="game-chat-composer">
        <textarea
          value={chatInput}
          disabled={!canSendMessage || isSending}
          onChange={(event) => setChatInput(event.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent
            const isImeComposing =
              isComposingRef.current
              || nativeEvent.isComposing
              || event.keyCode === 229

            if (isImeComposing) {
              return
            }

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendChatMessage()
            }
          }}
          placeholder={
            canSendMessage
              ? '메시지를 입력하세요...'
              : '방에 연결된 후 채팅을 보낼 수 있습니다.'
          }
          rows={2}
        />
        <button
          type="button"
          onClick={() => void sendChatMessage()}
          disabled={!canSendMessage || isSending || !chatInput.trim()}
          aria-label="메시지 전송"
        >
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
      {(!canSendMessage || sendMessage) && (
        <p className="game-chat-feedback">
          {sendMessage || '방에 연결된 후 채팅을 보낼 수 있습니다.'}
        </p>
      )}
    </section>
  )
}

function AttackTimelineCard({
  attack,
  result,
}: {
  attack?: Extract<GameTimelineEvent, { type: 'attack' }>
  result?: Extract<GameTimelineEvent, { type: 'attack-result' }>
}) {
  const [imageUrl, setImageUrl] = useState('')
  const timestamp = attack?.timestamp ?? result?.timestamp ?? new Date().toISOString()
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))

  useEffect(() => {
    if (!attack) {
      return
    }

    let isMounted = true
    let objectUrl = ''

    void downloadAttackContentBlob(attack.media.contentId)
      .then((blob) => {
        if (!isMounted) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        if (isMounted) {
          setImageUrl('')
        }
      })

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [attack])

  return (
    <article className="chat-message game-timeline-attack-card">
      <div className="chat-message-meta">
        <strong>{attack?.displayName ?? 'SYSTEM'} <span>[ATTACK]</span></strong>
        <time>{time}</time>
      </div>
      {attack ? (
        imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer">
            <img src={imageUrl} alt="공격 이미지" draggable={false} />
          </a>
        ) : (
          <p>공격 이미지를 불러오는 중입니다.</p>
        )
      ) : (
        <p>공격 기록을 불러오는 중입니다.</p>
      )}
      <div className="game-timeline-attack-result">
        <strong>{result?.title ?? 'ATTACKING'}</strong>
        {result?.defenderResults?.length ? (
          <div className="game-timeline-defender-results">
            {result.defenderResults.map((defender) => (
              <div key={defender.participantIdentity}>
                <span>{defender.displayName}</span>
                <b>{defender.hit ? '♥ -1' : 'SAFE'}</b>
                {defender.eliminated && <em>ELIMINATED</em>}
              </div>
            ))}
          </div>
        ) : (
          <p>{result?.message ?? '공격이 진행 중입니다.'}</p>
        )}
      </div>
    </article>
  )
}

function GameTimelineCard({ event }: { event: GameTimelineEvent }) {
  const [imageUrl, setImageUrl] = useState('')
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(event.timestamp))

  useEffect(() => {
    if (event.type !== 'attack') {
      return
    }

    let isMounted = true
    let objectUrl = ''

    void downloadAttackContentBlob(event.media.contentId)
      .then((blob) => {
        if (!isMounted) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        if (isMounted) {
          setImageUrl('')
        }
      })

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [event])

  if (event.type === 'attack') {
    return (
      <div className="chat-message game-timeline-event is-attack">
        <div className="chat-message-meta">
          <strong>{event.displayName} <span>[ATTACK]</span></strong>
          <time>{time}</time>
        </div>
        {imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer">
            <img src={imageUrl} alt="공격 이미지" draggable={false} />
          </a>
        ) : (
          <p>공격 이미지를 불러오는 중입니다.</p>
        )}
      </div>
    )
  }

  if (event.type === 'attack-result') {
    return (
      <div className="chat-message game-timeline-event is-result is-system">
        <div className="chat-message-meta">
          <strong>{event.title}</strong>
          <time>{time}</time>
        </div>
        <p>{event.message}</p>
      </div>
    )
  }

  if (event.type === 'elimination') {
    return (
      <div className="chat-message game-timeline-event is-elimination is-system">
        <div className="chat-message-meta">
          <strong>SYSTEM</strong>
          <time>{time}</time>
        </div>
        <p>{event.displayName} ELIMINATED</p>
      </div>
    )
  }

  if (event.type === 'game-result') {
    return (
      <div className="chat-message game-timeline-event is-result is-system">
        <div className="chat-message-meta">
          <strong>{event.title}</strong>
          <time>{time}</time>
        </div>
        <p>{event.message}</p>
      </div>
    )
  }

  return (
    <div className="chat-message game-timeline-event is-system">
      <div className="chat-message-meta">
        <strong>SYSTEM</strong>
        <time>{time}</time>
      </div>
      <p>{event.message}</p>
    </div>
  )
}
