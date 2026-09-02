type Sound = 'click' | 'build' | 'recruit' | 'march' | 'clash' | 'victory' | 'defeat' | 'endTurn' | 'event' | 'war' | 'peace' | 'coin' | 'error'

const KEY = 'nationstate-muted'

/** Tiny procedural sound designer: no audio files, everything is synthesised on demand. */
class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  constructor() {
    try { this.muted = localStorage.getItem(KEY) === '1' } catch { /* ignore */ }
  }

  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* ignore */ }
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return null
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.35
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, freqEnd?: number) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private noise(dur: number, gain: number, filterFreq: number, when = 0, q = 1) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + when
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t0)
  }

  play(name: Sound) {
    if (this.muted) return
    switch (name) {
      case 'click': this.tone(720, 0.05, 'square', 0.05); break
      case 'error': this.tone(180, 0.15, 'sawtooth', 0.08, 0, 120); break
      case 'build': this.tone(440, 0.08, 'triangle', 0.12); this.tone(660, 0.12, 'triangle', 0.12, 0.08); this.noise(0.08, 0.1, 1200, 0.02); break
      case 'coin': this.tone(1320, 0.08, 'sine', 0.1); this.tone(1760, 0.16, 'sine', 0.08, 0.06); break
      case 'recruit': this.noise(0.12, 0.25, 180, 0, 0.7); this.tone(90, 0.2, 'sine', 0.3, 0, 50); this.noise(0.1, 0.18, 220, 0.18, 0.7); this.tone(90, 0.2, 'sine', 0.25, 0.18, 50); break
      case 'march': for (let i = 0; i < 6; i++) { this.noise(0.08, 0.16, 200, i * 0.16, 0.8); this.tone(80, 0.14, 'sine', 0.22, i * 0.16, 55) } break
      case 'clash': this.noise(0.35, 0.5, 900, 0, 0.5); this.tone(2200, 0.25, 'square', 0.05, 0.01, 600); this.tone(60, 0.35, 'sine', 0.35, 0, 30); this.noise(0.5, 0.2, 300, 0.1, 0.4); break
      case 'endTurn': this.noise(0.5, 0.12, 400, 0, 0.3); this.tone(392, 0.4, 'sine', 0.06, 0.05, 523); break
      case 'event': this.tone(880, 0.6, 'sine', 0.12); this.tone(1320, 0.5, 'sine', 0.06, 0.02); this.tone(1760, 0.4, 'sine', 0.03, 0.04); break
      case 'war': this.tone(110, 0.5, 'sawtooth', 0.12, 0, 90); this.tone(165, 0.5, 'sawtooth', 0.1, 0.05, 130); this.noise(0.4, 0.2, 150, 0.1, 0.6); this.tone(110, 0.6, 'sawtooth', 0.14, 0.5, 80); break
      case 'peace': [523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, i * 0.12)); break
      case 'victory': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.14, i * 0.15)); this.tone(1047, 1.2, 'triangle', 0.12, 0.7); break
      case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.7, 'sawtooth', 0.08, i * 0.3)); break
    }
  }
}

export const audio = new AudioManager()
