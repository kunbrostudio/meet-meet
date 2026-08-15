import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type {
  GameFairPlayEventRequest,
} from '../types/game'

export const FAIR_PLAY_DETECTOR_VERSION = 'visual-mvp-1'
export const FAIR_PLAY_CHECK_VERSION = 1
export const FAIR_PLAY_CALIBRATION_VERSION = 1

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

const DETECTION_INTERVAL_MS = 90
const FACE_MISSING_GRACE_MS = 500
const MOUTH_OCCLUSION_GRACE_MS = 500
const VISIBILITY_COUNTDOWN_MS = 4000
const LAUGH_TRIGGER_SCORE = 0.52
const LAUGH_REARM_SCORE = 0.32
const LAUGH_MIN_DURATION_MS = 260
const LAUGH_LOCK_MS = 1400
const OCCLUSION_LOCK_MS = 800
const FAIR_PLAY_CALIBRATION_STORAGE_KEY = 'meet-meet:fair-play-calibration'

type LaughState = 'neutral' | 'candidate' | 'triggered' | 'locked'
type FaceCheckStep =
  | 'look-forward'
  | 'mouth-open'
  | 'smile'
  | 'passed'
  | 'failed'
type FaceCheckMode = 'full' | 'quick'

export type FairPlayWarningState = {
  active: boolean
  reason?: 'mouth-occluded' | 'face-not-visible'
  message?: string
  remainingMs?: number
}

export type FairPlayDebugState = {
  smileScore: number
  cheekScore: number
  mouthWidthScore: number
  laughScore: number
  sustainedFrames: number
  laughState: LaughState
  faceVisible: boolean
  mouthOccluded: boolean
  warningRemainingMs: number
}

export type FairPlayCheckUiState = {
  active: boolean
  step: FaceCheckStep
  message: string
  passed: boolean
  failed: boolean
}

type DetectorCallbacks = {
  onCheckState?: (state: FairPlayCheckUiState) => void
  onCheckResult?: (result: {
    passed: boolean
    checkVersion: number
    calibrationVersion: number
  }) => void
  onFairPlayEvent?: (event: Omit<
    GameFairPlayEventRequest,
    'type' | 'meetingId' | 'roomCode' | 'roundNumber' | 'attackSequence'
  >) => void
  onWarning?: (warning: FairPlayWarningState) => void
  onDebug?: (debug: FairPlayDebugState) => void
}

type CalibrationState = {
  neutralSmileScore: number
  neutralMouthOpen: number
  smileReferenceScore: number
}

type StoredCalibrationState = CalibrationState & {
  calibrationVersion: number
  savedAt: string
}

function getDefaultCalibration(): CalibrationState {
  return {
    neutralSmileScore: 0,
    neutralMouthOpen: 0,
    smileReferenceScore: 0.45,
  }
}

function loadStoredCalibration(): CalibrationState | null {
  try {
    const rawCalibration = window.sessionStorage.getItem(
      FAIR_PLAY_CALIBRATION_STORAGE_KEY,
    )

    if (!rawCalibration) {
      return null
    }

    const calibration = JSON.parse(rawCalibration) as Partial<StoredCalibrationState>

    if (
      calibration.calibrationVersion !== FAIR_PLAY_CALIBRATION_VERSION
      || typeof calibration.neutralSmileScore !== 'number'
      || typeof calibration.neutralMouthOpen !== 'number'
      || typeof calibration.smileReferenceScore !== 'number'
    ) {
      return null
    }

    return {
      neutralSmileScore: calibration.neutralSmileScore,
      neutralMouthOpen: calibration.neutralMouthOpen,
      smileReferenceScore: calibration.smileReferenceScore,
    }
  } catch {
    return null
  }
}

function saveStoredCalibration(calibration: CalibrationState): void {
  try {
    window.sessionStorage.setItem(
      FAIR_PLAY_CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        ...calibration,
        calibrationVersion: FAIR_PLAY_CALIBRATION_VERSION,
        savedAt: new Date().toISOString(),
      } satisfies StoredCalibrationState),
    )
  } catch {
    // Face calibration is an optimization; detection can continue without storage.
  }
}

export class FairPlayDetector {
  private video: HTMLVideoElement
  private callbacks: DetectorCallbacks
  private faceLandmarker: FaceLandmarker | null = null
  private handLandmarker: HandLandmarker | null = null
  private running = false
  private mode: 'idle' | 'face-check' | 'attack' = 'idle'
  private lastDetectionAt = 0
  private animationFrameId = 0
  private processing = false
  private calibration: CalibrationState = loadStoredCalibration() ?? getDefaultCalibration()
  private faceCheckStartedAt = 0
  private faceStableSince = 0
  private mouthOpenSeen = false
  private smileSeen = false
  private faceCheckMode: FaceCheckMode = 'full'
  private laughState: LaughState = 'neutral'
  private laughCandidateStartedAt = 0
  private laughSustainedFrames = 0
  private laughLockedUntil = 0
  private visibilityReason: 'mouth-occluded' | 'face-not-visible' | null = null
  private visibilityStartedAt = 0
  private visibilityPenaltyLockedUntil = 0
  private occlusionSequence = 0
  private frameDiagnosticLogged = false
  private lastLoggedFaceCheckStep: FaceCheckStep | 'camera' | null = null

  constructor(video: HTMLVideoElement, callbacks: DetectorCallbacks = {}) {
    this.video = video
    this.callbacks = callbacks
  }

  setVideo(video: HTMLVideoElement): void {
    this.video = video
  }

  async initialize(): Promise<void> {
    if (this.faceLandmarker && this.handLandmarker) {
      return
    }

    const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
    const [faceLandmarker, handLandmarker] = await Promise.all([
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL },
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    ])

    this.faceLandmarker = faceLandmarker
    this.handLandmarker = handLandmarker
  }

  async startFaceCheck(options: { mode?: FaceCheckMode } = {}): Promise<void> {
    await this.initialize()
    this.mode = 'face-check'
    this.faceCheckMode = options.mode ?? 'full'
    this.lastDetectionAt = 0
    this.processing = false
    this.frameDiagnosticLogged = false
    this.lastLoggedFaceCheckStep = null
    this.faceCheckStartedAt = performance.now()
    this.faceStableSince = 0
    this.mouthOpenSeen = this.faceCheckMode === 'quick'
    this.smileSeen = this.faceCheckMode === 'quick'
    if (import.meta.env.DEV) {
      console.info('[fair-play-stage]', { CAMERA: 'pass' })
    }
    this.callbacks.onCheckState?.({
      active: true,
      step: 'look-forward',
      message: '카메라 정면을 봐주세요.',
      passed: false,
      failed: false,
    })
    this.startLoop()
  }

  async startAttackDetection(): Promise<void> {
    await this.initialize()
    this.mode = 'attack'
    this.lastDetectionAt = 0
    this.processing = false
    this.frameDiagnosticLogged = false
    this.resetEpisodeState()
    this.startLoop()
  }

  stop(): void {
    this.mode = 'idle'
    this.running = false
    this.processing = false
    this.callbacks.onWarning?.({ active: false })

    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = 0
    }
  }

  async close(): Promise<void> {
    this.stop()
    await this.faceLandmarker?.close()
    await this.handLandmarker?.close()
    this.faceLandmarker = null
    this.handLandmarker = null
  }

  private startLoop(): void {
    if (this.running) {
      return
    }

    this.running = true
    if (import.meta.env.DEV) {
      console.info('[fair-play-loop]', { status: 'started', mode: this.mode })
    }
    const tick = () => {
      if (!this.running) {
        return
      }

      const now = performance.now()
      if (
        !this.processing
        && now - this.lastDetectionAt >= DETECTION_INTERVAL_MS
        && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this.lastDetectionAt = now
        this.processing = true
        if (import.meta.env.DEV && !this.frameDiagnosticLogged) {
          this.frameDiagnosticLogged = true
          console.info('[fair-play-frame]', {
            status: 'processing',
            readyState: this.video.readyState,
            currentTime: this.video.currentTime,
          })
        }
        this.detect(now)
        this.processing = false
      }

      this.animationFrameId = window.requestAnimationFrame(tick)
    }

    tick()
  }

  private detect(now: number): void {
    if (!this.faceLandmarker || !this.handLandmarker) {
      return
    }

    const faceResult = this.faceLandmarker.detectForVideo(this.video, now)
    const handResult = this.handLandmarker.detectForVideo(this.video, now)
    const faceVisible = Boolean(faceResult.faceLandmarks[0])
    const mouthOccluded =
      faceVisible && this.isMouthOccluded(faceResult.faceLandmarks[0], handResult.landmarks)
    const blendScores = this.getBlendScores(faceResult)
    const mouthOpen = this.getMouthOpen(faceResult.faceLandmarks[0])
    const mouthWidthScore = this.getMouthWidth(faceResult.faceLandmarks[0])
    const laughScore = this.getLaughScore({
      smileScore: blendScores.smileScore,
      cheekScore: blendScores.cheekScore,
      mouthWidthScore,
    })

    this.callbacks.onDebug?.({
      smileScore: blendScores.smileScore,
      cheekScore: blendScores.cheekScore,
      mouthWidthScore,
      laughScore,
      sustainedFrames: this.laughSustainedFrames,
      laughState: this.laughState,
      faceVisible,
      mouthOccluded,
      warningRemainingMs: this.getVisibilityRemainingMs(now),
    })

    if (this.mode === 'face-check') {
      this.handleFaceCheck({
        now,
        faceVisible,
        mouthOccluded,
        mouthOpen,
        smileScore: blendScores.smileScore,
      })
      return
    }

    if (this.mode === 'attack') {
      this.handleVisibility({
        now,
        faceVisible,
        mouthOccluded,
      })
      this.handleLaughEpisode({
        now,
        smileScore: blendScores.smileScore,
        cheekScore: blendScores.cheekScore,
        mouthWidthScore,
        laughScore,
        faceVisible,
        mouthOccluded,
      })
    }
  }

  private handleFaceCheck(input: {
    now: number
    faceVisible: boolean
    mouthOccluded: boolean
    mouthOpen: number
    smileScore: number
  }): void {
    if (!input.faceVisible) {
      this.faceStableSince = 0
      this.logFaceCheckStage('look-forward')
      this.callbacks.onCheckState?.({
        active: true,
        step: 'failed',
        message: '얼굴을 카메라 안에 보여주세요.',
        passed: false,
        failed: true,
      })
      return
    }

    if (input.mouthOccluded) {
      this.logFaceCheckStage('look-forward')
      this.callbacks.onCheckState?.({
        active: true,
        step: 'failed',
        message: '입 주변을 가린 물건을 치워주세요.',
        passed: false,
        failed: true,
      })
      return
    }

    if (!this.faceStableSince) {
      this.faceStableSince = input.now
      this.calibration.neutralSmileScore = input.smileScore
      this.calibration.neutralMouthOpen = input.mouthOpen
    }

    const elapsed = input.now - this.faceCheckStartedAt

    if (elapsed < 1200) {
      this.logFaceCheckStage('look-forward')
      this.callbacks.onCheckState?.({
        active: true,
        step: 'look-forward',
        message: '카메라 정면을 봐주세요.',
        passed: false,
        failed: false,
      })
      return
    }

    if (this.faceCheckMode === 'quick') {
      this.logFaceCheckStage('passed')
      this.callbacks.onCheckState?.({
        active: false,
        step: 'passed',
        message: '확인 완료',
        passed: true,
        failed: false,
      })
      this.callbacks.onCheckResult?.({
        passed: true,
        checkVersion: FAIR_PLAY_CHECK_VERSION,
        calibrationVersion: FAIR_PLAY_CALIBRATION_VERSION,
      })
      this.stop()
      return
    }

    if (input.mouthOpen > this.calibration.neutralMouthOpen + 0.018) {
      this.mouthOpenSeen = true
    }

    if (!this.mouthOpenSeen) {
      this.logFaceCheckStage('mouth-open')
      this.callbacks.onCheckState?.({
        active: true,
        step: 'mouth-open',
        message: '입을 한번 벌려주세요.',
        passed: false,
        failed: false,
      })
      return
    }

    if (input.smileScore > Math.max(0.34, this.calibration.neutralSmileScore + 0.16)) {
      this.smileSeen = true
      this.calibration.smileReferenceScore = input.smileScore
    }

    if (!this.smileSeen) {
      this.logFaceCheckStage('smile')
      this.callbacks.onCheckState?.({
        active: true,
        step: 'smile',
        message: '살짝 웃어주세요.',
        passed: false,
        failed: false,
      })
      return
    }

    this.logFaceCheckStage('passed')
    this.callbacks.onCheckState?.({
      active: false,
      step: 'passed',
      message: '확인 완료',
      passed: true,
      failed: false,
    })
    this.callbacks.onCheckResult?.({
      passed: true,
      checkVersion: FAIR_PLAY_CHECK_VERSION,
      calibrationVersion: FAIR_PLAY_CALIBRATION_VERSION,
    })
    saveStoredCalibration(this.calibration)
    this.stop()
  }

  private logFaceCheckStage(step: FaceCheckStep): void {
    if (!import.meta.env.DEV || this.lastLoggedFaceCheckStep === step) {
      return
    }

    this.lastLoggedFaceCheckStep = step

    if (step === 'look-forward') {
      console.info('[fair-play-stage]', { FACE: 'checking' })
      return
    }

    if (step === 'mouth-open') {
      console.info('[fair-play-stage]', { FACE: 'pass', MOUTH: 'checking' })
      return
    }

    if (step === 'smile') {
      console.info('[fair-play-stage]', { MOUTH: 'pass', SMILE: 'checking' })
      return
    }

    if (step === 'passed') {
      console.info('[fair-play-stage]', { SMILE: 'pass' })
    }
  }

  private handleLaughEpisode(input: {
    now: number
    smileScore: number
    cheekScore: number
    mouthWidthScore: number
    laughScore: number
    faceVisible: boolean
    mouthOccluded: boolean
  }): void {
    if (!input.faceVisible || input.mouthOccluded || input.now < this.laughLockedUntil) {
      return
    }

    const score = input.laughScore

    if (this.laughState === 'neutral') {
      if (score >= LAUGH_TRIGGER_SCORE) {
        this.laughState = 'candidate'
        this.laughCandidateStartedAt = input.now
        this.laughSustainedFrames = 1
        this.logLaughDetection({
          score,
          triggered: false,
        })
      }
      return
    }

    if (this.laughState === 'candidate') {
      if (score < LAUGH_REARM_SCORE) {
        this.laughState = 'neutral'
        this.laughCandidateStartedAt = 0
        this.laughSustainedFrames = 0
        return
      }

      this.laughSustainedFrames += 1

      if (
        this.laughSustainedFrames >= 3
        && input.now - this.laughCandidateStartedAt >= LAUGH_MIN_DURATION_MS
      ) {
        this.laughState = 'locked'
        this.laughLockedUntil = input.now + LAUGH_LOCK_MS
        this.logLaughDetection({
          score,
          triggered: true,
        })
        this.callbacks.onFairPlayEvent?.({
          eventId: crypto.randomUUID(),
          reason: 'visible-laugh',
          detectorVersion: FAIR_PLAY_DETECTOR_VERSION,
          scoreSummary: {
            smileScore: input.smileScore,
            cheekScore: input.cheekScore,
          },
          detectedAt: new Date().toISOString(),
        })
      }
      return
    }

    if (this.laughState === 'locked' && score < LAUGH_REARM_SCORE) {
      this.laughState = 'neutral'
    }
  }

  private handleVisibility(input: {
    now: number
    faceVisible: boolean
    mouthOccluded: boolean
  }): void {
    const nextReason =
      !input.faceVisible
        ? 'face-not-visible'
        : input.mouthOccluded
          ? 'mouth-occluded'
          : null

    if (!nextReason) {
      this.visibilityReason = null
      this.visibilityStartedAt = 0
      this.callbacks.onWarning?.({ active: false })
      return
    }

    const graceMs =
      nextReason === 'face-not-visible'
        ? FACE_MISSING_GRACE_MS
        : MOUTH_OCCLUSION_GRACE_MS

    if (this.visibilityReason !== nextReason || !this.visibilityStartedAt) {
      this.visibilityReason = nextReason
      this.visibilityStartedAt = input.now
      return
    }

    const warningStartedAt = this.visibilityStartedAt + graceMs
    const remainingMs =
      Math.max(0, VISIBILITY_COUNTDOWN_MS - (input.now - warningStartedAt))

    if (input.now >= warningStartedAt) {
      this.callbacks.onWarning?.({
        active: true,
        reason: nextReason,
        message:
          nextReason === 'face-not-visible'
            ? '얼굴을 보여주세요!'
            : '입을 보여주세요!',
        remainingMs,
      })
    }

    if (
      remainingMs === 0
      && input.now >= this.visibilityPenaltyLockedUntil
    ) {
      this.visibilityPenaltyLockedUntil = input.now + OCCLUSION_LOCK_MS
      this.occlusionSequence += 1
      this.callbacks.onFairPlayEvent?.({
        eventId: `${nextReason}:${this.occlusionSequence}:${crypto.randomUUID()}`,
        reason:
          nextReason === 'face-not-visible'
            ? 'face-not-visible-timeout'
            : 'mouth-occlusion-timeout',
        detectorVersion: FAIR_PLAY_DETECTOR_VERSION,
        detectedAt: new Date().toISOString(),
      })
      this.visibilityStartedAt = input.now
    }
  }

  private getBlendScores(result: FaceLandmarkerResult): {
    smileScore: number
    cheekScore: number
  } {
    const categories = result.faceBlendshapes[0]?.categories ?? []
    const getScore = (name: string) => (
      categories.find((category) => category.categoryName === name)?.score ?? 0
    )

    return {
      smileScore: (
        getScore('mouthSmileLeft')
        + getScore('mouthSmileRight')
      ) / 2,
      cheekScore: (
        getScore('cheekSquintLeft')
        + getScore('cheekSquintRight')
      ) / 2,
    }
  }

  private getMouthOpen(faceLandmarks: NormalizedLandmark[] | undefined): number {
    if (!faceLandmarks) {
      return 0
    }

    const upperLip = faceLandmarks[13]
    const lowerLip = faceLandmarks[14]

    if (!upperLip || !lowerLip) {
      return 0
    }

    return Math.abs(lowerLip.y - upperLip.y)
  }

  private getMouthWidth(faceLandmarks: NormalizedLandmark[] | undefined): number {
    if (!faceLandmarks) {
      return 0
    }

    const leftMouth = faceLandmarks[61]
    const rightMouth = faceLandmarks[291]

    if (!leftMouth || !rightMouth) {
      return 0
    }

    return Math.abs(rightMouth.x - leftMouth.x)
  }

  private getLaughScore(input: {
    smileScore: number
    cheekScore: number
    mouthWidthScore: number
  }): number {
    const smileDelta = Math.max(
      0,
      input.smileScore - this.calibration.neutralSmileScore,
    )
    const referenceBoost =
      this.calibration.smileReferenceScore > 0
        ? input.smileScore / Math.max(0.24, this.calibration.smileReferenceScore)
        : input.smileScore
    const mouthWidthSignal = Math.min(1, input.mouthWidthScore * 4.8)

    return Math.max(
      input.smileScore * 0.58 + input.cheekScore * 0.24 + mouthWidthSignal * 0.18,
      smileDelta * 0.66 + input.cheekScore * 0.2 + Math.min(1, referenceBoost) * 0.14,
    )
  }

  private logLaughDetection(input: {
    score: number
    triggered: boolean
  }): void {
    if (!import.meta.env.DEV) {
      return
    }

    console.debug('[laugh-detect]', {
      score: Number(input.score.toFixed(3)),
      sustainedFrames: this.laughSustainedFrames,
      triggered: input.triggered,
    })
  }

  private isMouthOccluded(
    faceLandmarks: NormalizedLandmark[] | undefined,
    handLandmarks: NormalizedLandmark[][],
  ): boolean {
    if (!faceLandmarks || handLandmarks.length === 0) {
      return false
    }

    const mouthPoints = [faceLandmarks[13], faceLandmarks[14], faceLandmarks[61], faceLandmarks[291]]
      .filter((point): point is NormalizedLandmark => Boolean(point))

    if (mouthPoints.length === 0) {
      return false
    }

    const xs = mouthPoints.map((point) => point.x)
    const ys = mouthPoints.map((point) => point.y)
    const left = Math.min(...xs) - 0.06
    const right = Math.max(...xs) + 0.06
    const top = Math.min(...ys) - 0.06
    const bottom = Math.max(...ys) + 0.06

    return handLandmarks.some((hand) => (
      hand.some((point) => (
        point.x >= left
        && point.x <= right
        && point.y >= top
        && point.y <= bottom
      ))
    ))
  }

  private getVisibilityRemainingMs(now: number): number {
    if (!this.visibilityReason || !this.visibilityStartedAt) {
      return 0
    }

    return Math.max(0, VISIBILITY_COUNTDOWN_MS - (now - this.visibilityStartedAt))
  }

  private resetEpisodeState(): void {
    this.laughState = 'neutral'
    this.laughCandidateStartedAt = 0
    this.laughSustainedFrames = 0
    this.laughLockedUntil = 0
    this.visibilityReason = null
    this.visibilityStartedAt = 0
    this.visibilityPenaltyLockedUntil = 0
  }
}
