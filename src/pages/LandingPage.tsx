import { useState } from 'react'
import type { FormEvent } from 'react'
import meetingCollaboration from '../assets/landing/meeting-collaboration.jpg'
import meetingSpeaker from '../assets/landing/meeting-speaker.jpg'
import { Icon } from '../components/common/Icon'
import { parseRoomCodeFromUrl } from '../services/roomService'

type LandingPageProps = {
  onStart: () => void | Promise<void>
  onJoin: (code: string) => string | null | Promise<string | null>
}

export function LandingPage({ onStart, onJoin }: LandingPageProps) {
  const [code, setCode] = useState(() => parseRoomCodeFromUrl() ?? '')
  const [codeError, setCodeError] = useState('')

  const joinMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!code.trim()) {
      setCodeError('방 코드를 입력해주세요.')
      return
    }

    const error = await onJoin(code)
    setCodeError(error ?? '')
  }

  return (
    <section className="figma-landing">
      <div className="figma-grid">
        <article className="figma-card figma-intro-card">
          <div className="figma-brand">
            <span className="figma-brand-mark">
              MM
            </span>
            <span>MEET MEET</span>
          </div>

          <div className="figma-intro-copy">
            <span className="figma-kicker">밋밋</span>
            <h1>
              별거 없는 게임,<br />
              별일 다 생기는<br />
              <em>방.</em>
            </h1>
          </div>

          <p className="figma-card-note">
            친구들과 만나서 바로 노는 실시간 화상 놀이터
          </p>
        </article>

        <article className="figma-card figma-image-card">
          <img src={meetingSpeaker} alt="화상방에서 이야기하고 있는 참가자" />
          <div className="image-card-overlay">
            <span className="image-status"><i /> Live room</span>
            <div className="image-caption">
              <span>2-4 friends</span>
              <p>카메라 켜고 바로 입장하세요.</p>
            </div>
          </div>
        </article>

        <article className="figma-card figma-image-card">
          <img src={meetingCollaboration} alt="화상방을 준비하는 친구들" />
          <div className="meeting-card-ui">
            <div className="meeting-card-top">
              <span>Laugh battle</span>
              <span className="meeting-card-time">09:42</span>
            </div>
            <div className="meeting-card-people">
              <span>KC</span>
              <span>SM</span>
              <span>YT</span>
              <b>+2</b>
            </div>
          </div>
        </article>

        <article className="figma-card figma-action-card">
          <div>
            <span className="figma-action-index">04 / GET STARTED</span>
            <h2>친구들과<br />바로 시작하기.</h2>
          </div>

          <div className="figma-entry-actions">
            <button className="figma-start-button" type="button" onClick={onStart}>
              <span>방 만들기</span>
              <Icon name="arrow-right" size={21} />
            </button>

            <form className={`figma-code-form ${codeError ? 'has-error' : ''}`} onSubmit={joinMeeting}>
              <label htmlFor="meeting-code">코드로 입장</label>
              <div className="figma-code-row">
                <input
                  id="meeting-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setCodeError('')
                  }}
                  placeholder="MMT-XXXXXX"
                  aria-invalid={Boolean(codeError)}
                />
                <button type="submit">입장 <Icon name="arrow-right" size={15} /></button>
              </div>
              {codeError && <span className="code-error">{codeError}</span>}
            </form>
          </div>
        </article>
      </div>
    </section>
  )
}
