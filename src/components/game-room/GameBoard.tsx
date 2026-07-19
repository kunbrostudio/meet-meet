import type { ReactNode } from 'react'
import type { ChatMessage } from '../../types/chat'
import { GameBoardHeader } from './GameBoardHeader'
import { GameChatPanel } from './GameChatPanel'

export type GameBoardPhase =
  | 'waiting'
  | 'countdown'
  | 'game'

type GameBoardProps = {
  phase?: GameBoardPhase
  chatMessages: ChatMessage[]
  localParticipantId?: number
  onSendChatMessage: (message: string) => void | Promise<void>
  canSendChatMessage?: boolean
  chatSendMessage?: string
  screenShareSlot?: ReactNode
}

export function GameBoard({
  phase = 'waiting',
  chatMessages,
  localParticipantId,
  onSendChatMessage,
  canSendChatMessage,
  chatSendMessage,
  screenShareSlot,
}: GameBoardProps) {
  return (
    <section className="game-board" aria-label="GAME BOARD">
      <GameBoardHeader phase={phase} />
      {screenShareSlot && (
        <div className="game-board-screen-share">
          {screenShareSlot}
        </div>
      )}
      <GameChatPanel
        messages={chatMessages}
        localParticipantId={localParticipantId}
        onSendMessage={onSendChatMessage}
        canSendMessage={canSendChatMessage}
        sendMessage={chatSendMessage}
      />
    </section>
  )
}
