import { Icon } from '../common/Icon'
import type { GameBoardPhase } from './GameBoard'

const phaseLabels: Record<GameBoardPhase, string> = {
  waiting: '대기 중',
  countdown: '준비 중',
  game: '게임 중',
}

export function GameBoardHeader({ phase }: { phase: GameBoardPhase }) {
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
      <span className="game-board-phase">{phaseLabels[phase]}</span>
    </header>
  )
}
