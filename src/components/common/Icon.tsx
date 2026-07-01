type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'calendar'
  | 'camera'
  | 'captions'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'copy'
  | 'download'
  | 'globe'
  | 'grid'
  | 'hand'
  | 'headphones'
  | 'lock'
  | 'link'
  | 'message'
  | 'mic'
  | 'mic-off'
  | 'more'
  | 'phone'
  | 'screen'
  | 'sparkles'
  | 'summary'
  | 'users'
  | 'video'
  | 'video-off'
  | 'wave'

type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
}

const paths: Record<IconName, React.ReactNode> = {
  'arrow-left': <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
  'arrow-right': <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  camera: <><path d="m15 10 4.6-2.7A1 1 0 0 1 21 8.2v7.6a1 1 0 0 1-1.4.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h3M14 10h3M7 14h4M14 14h3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m7 10 5 5 5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  hand: <path d="M7 11V7a1.5 1.5 0 0 1 3 0v3-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.8-2.4L3 14a1.5 1.5 0 0 1 2.2-2z" />,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M18 19h-1a2 2 0 0 1-2-2v-3h5v3a2 2 0 0 1-2 2ZM6 19H5a2 2 0 0 1-2-2v-3h5v3a2 2 0 0 1-2 2Z" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>,
  'mic-off': <><path d="m3 3 18 18" /><path d="M9 9v2a3 3 0 0 0 4.5 2.6M15 10.3V6a3 3 0 0 0-5.8-1M5 11a7 7 0 0 0 11.7 5.2M19 11a7 7 0 0 1-.4 2.3M12 18v3M9 21h6" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z" />,
  screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  sparkles: <><path d="m12 3-1.2 3.3L7.5 7.5l3.3 1.2L12 12l1.2-3.3 3.3-1.2-3.3-1.2z" /><path d="m5 14-.7 2.3L2 17l2.3.7L5 20l.7-2.3L8 17l-2.3-.7zM19 13l-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6z" /></>,
  summary: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  video: <><path d="m15 10 5-3v10l-5-3" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
  'video-off': <><path d="m2 2 20 20M10.7 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 1.7-1M15 10l5-3v10l-2-1.2" /></>,
  wave: <><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></>,
}

export function Icon({ name, size = 20, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
