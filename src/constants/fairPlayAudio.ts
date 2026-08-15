export const AUDIO_LAUGH_CANDIDATE_THRESHOLD = 0.45
export const AUDIO_LAUGH_TRIGGER_THRESHOLD = 0.70
export const AUDIO_LAUGH_VERY_HIGH_THRESHOLD = 0.85
export const AUDIO_LAUGH_REARM_THRESHOLD = 0.32
export const AUDIO_LAUGH_EPISODE_LOCK_MS = 1800
export const AUDIO_LAUGH_TRIGGER_WINDOW_MS = 950
export const AUDIO_LAUGH_INFERENCE_INTERVAL_MS = 450
export const AUDIO_LAUGH_SAMPLE_WINDOW_MS = 975
export const AUDIO_LAUGH_MODEL_PATH =
  import.meta.env.VITE_FAIR_PLAY_AUDIO_MODEL_PATH ?? '/models/yamnet.tflite'
export const AUDIO_TASKS_WASM_PATH =
  import.meta.env.VITE_MEDIAPIPE_AUDIO_WASM_PATH
  ?? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@latest/wasm'

export const AUDIO_LAUGH_CATEGORY_ALLOWLIST = [
  'Laughter',
  'Giggle',
  'Snicker',
  'Belly laugh',
  'Chuckle, chortle',
] as const
