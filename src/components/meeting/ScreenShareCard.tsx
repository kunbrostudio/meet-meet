import { useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'

type ScreenShareCardProps = {
  stream: MediaStream
  participantName?: string
  canStop?: boolean
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onStop?: () => void
}

export function ScreenShareCard({
  stream,
  participantName,
  canStop = true,
  isExpanded = false,
  onExpand,
  onCollapse,
  onStop,
}: ScreenShareCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current

    if (video) {
      video.srcObject = stream
      void video.play().catch(() => undefined)
    }

    return () => {
      if (video) {
        video.srcObject = null
      }
    }
  }, [stream])

  return (
    <article className={`screen-share-card ${isExpanded ? 'is-expanded' : ''}`}>
      <video ref={videoRef} autoPlay muted playsInline />
      <span className="screen-share-label">
        <i /> {participantName ? `${participantName}의 화면 공유` : '내 화면 공유'}
      </span>
      <div className="screen-share-actions">
        {(onExpand || onCollapse) && (
          isExpanded ? (
            <button type="button" onClick={onCollapse}>
              전체보기 종료
            </button>
          ) : (
            <button type="button" onClick={onExpand}>
              전체보기
            </button>
          )
        )}
        {canStop && onStop && (
          <button type="button" className="is-danger" onClick={onStop}>
            <Icon name="screen" size={14} /> 공유 중지
          </button>
        )}
      </div>
    </article>
  )
}
