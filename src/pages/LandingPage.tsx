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
              <img src="/images/say-merang-symbol.png" alt="Say, Merang" />
            </span>
            <span>Say, Merang</span>
          </div>

          <div className="figma-intro-copy">
            <span className="figma-kicker">Connect beyond language.</span>
            <h1>
              Speak freely.<br />
              Understand<br />
              <em>everyone.</em>
            </h1>
          </div>

          <p className="figma-card-note">
            Real-time translation for conversations that feel natural.
          </p>
        </article>

        <article className="figma-card figma-image-card">
          <img src={meetingSpeaker} alt="영상 미팅에서 이야기하고 있는 참가자" />
          <div className="image-card-overlay">
            <span className="image-status"><i /> Live translation</span>
            <div className="image-caption">
              <span>EN → 한국어</span>
              <p>Let&apos;s make every conversation count.</p>
            </div>
          </div>
        </article>

        <article className="figma-card figma-image-card">
          <img src={meetingCollaboration} alt="화상 회의를 준비하는 팀원들" />
          <div className="meeting-card-ui">
            <div className="meeting-card-top">
              <span>Team sync</span>
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
            <h2>Experience it<br />right now.</h2>
          </div>

          <div className="figma-entry-actions">
            <button className="figma-start-button" type="button" onClick={onStart}>
              <span>Start Now</span>
              <Icon name="arrow-right" size={21} />
            </button>

            <form className={`figma-code-form ${codeError ? 'has-error' : ''}`} onSubmit={joinMeeting}>
              <label htmlFor="meeting-code">Already have a code?</label>
              <div className="figma-code-row">
                <input
                  id="meeting-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setCodeError('')
                  }}
                  placeholder="Enter Code"
                  aria-invalid={Boolean(codeError)}
                />
                <button type="submit">Join <Icon name="arrow-right" size={15} /></button>
              </div>
              {codeError && <span className="code-error">{codeError}</span>}
            </form>
          </div>
        </article>
      </div>
    </section>
  )
}
