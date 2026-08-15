import {
  AudioClassifier,
  FilesetResolver,
  type AudioClassifierResult,
} from '@mediapipe/tasks-audio'
import {
  AUDIO_LAUGH_CANDIDATE_THRESHOLD,
  AUDIO_LAUGH_CATEGORY_ALLOWLIST,
  AUDIO_LAUGH_EPISODE_LOCK_MS,
  AUDIO_LAUGH_INFERENCE_INTERVAL_MS,
  AUDIO_LAUGH_MODEL_PATH,
  AUDIO_LAUGH_REARM_THRESHOLD,
  AUDIO_LAUGH_SAMPLE_WINDOW_MS,
  AUDIO_LAUGH_TRIGGER_THRESHOLD,
  AUDIO_LAUGH_TRIGGER_WINDOW_MS,
  AUDIO_LAUGH_VERY_HIGH_THRESHOLD,
  AUDIO_TASKS_WASM_PATH,
} from '../constants/fairPlayAudio'

export const AUDIO_LAUGH_DETECTOR_VERSION = 'audio-yamnet-mvp-1'

export type AudioLaughEpisodeState =
  | 'neutral'
  | 'audio-candidate'
  | 'audio-triggered'
  | 'locked'

export type AudioLaughDebugState = {
  audioLaughScore: number
  topCategoryName?: string
  topCategoryScore?: number
  episodeState: AudioLaughEpisodeState
  unavailableReason?: string
}

export type AudioLaughEvent = {
  eventId: string
  audioLaughScore: number
  topCategoryName?: string
  topCategoryScore?: number
  episodeState: AudioLaughEpisodeState
  detectedAt: string
}

type AudioLaughDetectorCallbacks = {
  onAudioLaughEvent?: (event: AudioLaughEvent) => void
  onDebug?: (debug: AudioLaughDebugState) => void
  onUnavailable?: (reason: string) => void
}

type AudioLaughScore = {
  score: number
  topCategoryName?: string
  topCategoryScore?: number
}

export class AudioLaughDetector {
  private stream: MediaStream
  private callbacks: AudioLaughDetectorCallbacks
  private classifier: AudioClassifier | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private sampleBuffer: number[] = []
  private sampleRate = 48000
  private inferenceTimer: number | null = null
  private inferenceBusy = false
  private running = false
  private episodeState: AudioLaughEpisodeState = 'neutral'
  private candidateStartedAt = 0
  private lockedUntil = 0
  private lastDebug: AudioLaughDebugState = {
    audioLaughScore: 0,
    episodeState: 'neutral',
  }

  constructor(
    stream: MediaStream,
    callbacks: AudioLaughDetectorCallbacks = {},
  ) {
    this.stream = stream
    this.callbacks = callbacks
  }

  async initialize(): Promise<void> {
    if (this.classifier) {
      return
    }

    const audioTrack = this.stream.getAudioTracks()[0]

    if (!audioTrack || audioTrack.readyState === 'ended') {
      throw new Error('사용 가능한 마이크 트랙이 없습니다.')
    }

    const fileset = await FilesetResolver.forAudioTasks(AUDIO_TASKS_WASM_PATH)
    this.classifier = await AudioClassifier.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: AUDIO_LAUGH_MODEL_PATH,
        delegate: 'CPU',
      },
      categoryAllowlist: [...AUDIO_LAUGH_CATEGORY_ALLOWLIST],
      maxResults: AUDIO_LAUGH_CATEGORY_ALLOWLIST.length,
      scoreThreshold: AUDIO_LAUGH_CANDIDATE_THRESHOLD,
    })
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    try {
      await this.initialize()
      await this.startAudioGraph()
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : '오디오 웃음 감지를 시작하지 못했습니다.'
      this.callbacks.onUnavailable?.(reason)
      this.emitDebug({
        ...this.lastDebug,
        unavailableReason: reason,
      })
      return
    }

    this.running = true
    this.resetEpisodeState()
    this.inferenceTimer = window.setInterval(() => {
      this.runInference()
    }, AUDIO_LAUGH_INFERENCE_INTERVAL_MS)
  }

  stop(): void {
    this.running = false
    this.inferenceBusy = false
    this.sampleBuffer = []
    this.resetEpisodeState()

    if (this.inferenceTimer !== null) {
      window.clearInterval(this.inferenceTimer)
      this.inferenceTimer = null
    }

    this.processorNode?.disconnect()
    this.sourceNode?.disconnect()
    void this.audioContext?.close().catch(() => undefined)
    this.processorNode = null
    this.sourceNode = null
    this.audioContext = null
  }

  async close(): Promise<void> {
    this.stop()
    await this.classifier?.close()
    this.classifier = null
  }

  private async startAudioGraph(): Promise<void> {
    if (this.audioContext) {
      return
    }

    const AudioContextConstructor =
      window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextConstructor) {
      throw new Error('AudioContext를 사용할 수 없습니다.')
    }

    this.audioContext = new AudioContextConstructor()

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.sampleRate = this.audioContext.sampleRate
    this.classifier?.setDefaultSampleRate(this.sampleRate)
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processorNode.onaudioprocess = (event) => {
      if (!this.running) {
        return
      }

      const channelData = event.inputBuffer.getChannelData(0)
      const maxSamples = Math.ceil(
        this.sampleRate * (AUDIO_LAUGH_SAMPLE_WINDOW_MS / 1000) * 2,
      )

      this.sampleBuffer.push(...channelData)

      if (this.sampleBuffer.length > maxSamples) {
        this.sampleBuffer.splice(0, this.sampleBuffer.length - maxSamples)
      }
    }
    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
  }

  private runInference(): void {
    if (
      !this.running
      || this.inferenceBusy
      || !this.classifier
      || this.sampleBuffer.length < this.getRequiredSampleCount()
    ) {
      return
    }

    this.inferenceBusy = true

    try {
      const windowSamples = this.sampleBuffer.slice(-this.getRequiredSampleCount())
      const results = this.classifier.classify(
        Float32Array.from(windowSamples),
        this.sampleRate,
      )
      const laughScore = this.getLaughScore(results)
      this.updateEpisode(laughScore)
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : '오디오 분류에 실패했습니다.'
      this.callbacks.onUnavailable?.(reason)
      this.emitDebug({
        ...this.lastDebug,
        unavailableReason: reason,
      })
    } finally {
      this.inferenceBusy = false
    }
  }

  private updateEpisode(score: AudioLaughScore): void {
    const now = performance.now()

    this.emitDebug({
      audioLaughScore: score.score,
      topCategoryName: score.topCategoryName,
      topCategoryScore: score.topCategoryScore,
      episodeState: this.episodeState,
    })

    if (now < this.lockedUntil) {
      this.episodeState = 'locked'
      return
    }

    if (score.score >= AUDIO_LAUGH_VERY_HIGH_THRESHOLD) {
      this.triggerEpisode(score)
      return
    }

    if (score.score >= AUDIO_LAUGH_TRIGGER_THRESHOLD) {
      if (this.episodeState !== 'audio-candidate' || !this.candidateStartedAt) {
        this.episodeState = 'audio-candidate'
        this.candidateStartedAt = now
        return
      }

      if (now - this.candidateStartedAt >= AUDIO_LAUGH_TRIGGER_WINDOW_MS) {
        this.triggerEpisode(score)
      }
      return
    }

    if (score.score < AUDIO_LAUGH_REARM_THRESHOLD) {
      this.resetEpisodeState()
    }
  }

  private triggerEpisode(score: AudioLaughScore): void {
    this.episodeState = 'audio-triggered'
    this.lockedUntil = performance.now() + AUDIO_LAUGH_EPISODE_LOCK_MS
    this.callbacks.onAudioLaughEvent?.({
      eventId: `audio-laugh:${crypto.randomUUID()}`,
      audioLaughScore: score.score,
      topCategoryName: score.topCategoryName,
      topCategoryScore: score.topCategoryScore,
      episodeState: this.episodeState,
      detectedAt: new Date().toISOString(),
    })
    this.episodeState = 'locked'
  }

  private getLaughScore(results: AudioClassifierResult[]): AudioLaughScore {
    const categories = results.flatMap((result) => (
      result.classifications.flatMap((classification) => classification.categories)
    ))
    const laughterCategories = categories.filter((category) => (
      AUDIO_LAUGH_CATEGORY_ALLOWLIST.includes(
        category.categoryName as (typeof AUDIO_LAUGH_CATEGORY_ALLOWLIST)[number],
      )
    ))
    const topCategory = laughterCategories.reduce<typeof laughterCategories[number] | undefined>(
      (currentTopCategory, category) => (
        !currentTopCategory || category.score > currentTopCategory.score
          ? category
          : currentTopCategory
      ),
      undefined,
    )

    return {
      score: topCategory?.score ?? 0,
      topCategoryName: topCategory?.categoryName,
      topCategoryScore: topCategory?.score,
    }
  }

  private getRequiredSampleCount(): number {
    return Math.ceil(this.sampleRate * (AUDIO_LAUGH_SAMPLE_WINDOW_MS / 1000))
  }

  private resetEpisodeState(): void {
    this.episodeState = 'neutral'
    this.candidateStartedAt = 0
    this.lockedUntil = 0
  }

  private emitDebug(debug: AudioLaughDebugState): void {
    this.lastDebug = debug
    this.callbacks.onDebug?.(debug)
  }
}
