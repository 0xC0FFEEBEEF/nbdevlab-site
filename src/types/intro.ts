export interface IntroConfig {
  startWord: string
  targetWord: string
  scrambleDurationMs: number
  tickMs: number
  exitDurationMs: number
  charset: string
  storageKey: string
  reducedMotionSkipsScramble: boolean
}

export const defaultIntroConfig: IntroConfig = {
  startWord: 'hgdeklac',
  targetWord: 'nbdevlab',
  scrambleDurationMs: 4400,
  tickMs: 55,
  exitDurationMs: 2300,
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  storageKey: 'nbdevlab:intro:seen:v3',
  reducedMotionSkipsScramble: true,
}
