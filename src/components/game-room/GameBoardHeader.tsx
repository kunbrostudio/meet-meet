import { Icon } from '../common/Icon'
import type { GamePhase } from '../../types/game'

const phaseLabels: Record<GamePhase, string> = {
  waiting: '대기 중',
  ready: '준비 완료',
  countdown: '카운트다운',
  'attack-prep': '공격 준비',
  attacking: '공격 중',
  judging: '판정 중',
  'turn-result': '턴 결과',
  'game-result': '게임 결과',
}

type GameBoardHeaderProps = {
  phase: GamePhase
  statusText?: string
}

export function GameBoardHeader({
  phase,
  statusText,
}: GameBoardHeaderProps) {
  return (
    <header className="game-board-header">
      <div className="game-board-title">
        <span className="game-board-icon">
          <Icon name="grid" size={18} />
        </span>
        <div>
          <strong>GAME BOARD</strong>
          <p>웃참 공격전 준비 공간</p>
        </div>
      </div>
      <div className="game-board-status">
        {statusText && <small>{statusText}</small>}
        <span className="game-board-phase">{phaseLabels[phase]}</span>
      </div>
    </header>
  )
}
