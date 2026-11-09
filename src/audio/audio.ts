// Web Audio: placeholder sounds are synthesised, music is a tiny step sequencer.
// Any file in /art/audio named by sound id (sfx_tap.ogg, bgm_world1.mp3, ...) replaces the synth.

const FILES = import.meta.glob('/art/audio/*.{ogg,mp3,m4a,wav}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Every delivered sound file's URL, for warming the offline cache. */
export function audioUrls(): string[] {
  return Object.values(FILES);
}

function fileFor(id: string): string | undefined {
  for (const ext of ['ogg', 'm4a', 'mp3', 'wav']) {
    const url = FILES[`/art/audio/${id}.${ext}`];
    if (url) return url;
  }
  return undefined;
}

type Voice = { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; delay?: number; attack?: number };
type Noise = { dur: number; gain?: number; filter?: number; to?: number; kind?: BiquadFilterType; delay?: number; q?: number };

const n2f = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Track {
  bpm: number;
  root: number;
  lead: string;
  bass: string;
  drums: string;
  wave: OscillatorType;
}

const TRACKS: Record<string, Track> = {
  bgm_title: {
    bpm: 92,
    root: 60,
    wave: 'triangle',
    lead: '16 . 14 . 12 . 9 . 12 . 14 . 16 - - . 19 . 16 . 14 . 12 . 14 - - . . . . .',
    bass: '0 . . . 7 . . . 5 . . . 7 . . . 0 . . . 7 . . . 5 . . . 7 . . .',
    drums: 'k . h . s . h . k . h . s . h . k . h . s . h . k . h . s . h h',
  },
  bgm_map: {
    bpm: 100,
    root: 62,
    wave: 'triangle',
    lead: '9 . 12 . 14 . 16 . 14 . 12 . 9 - - . 7 . 9 . 12 . 14 . 12 - - . . . . .',
    bass: '0 . 7 . 0 . 7 . 5 . 12 . 5 . 12 . 3 . 10 . 3 . 10 . 7 . 14 . 7 . 14 .',
    drums: 'k . h . s . h . k . h . s . h . k . h . s . h . k . h . s h h .',
  },
  bgm_world1: {
    bpm: 128,
    root: 67,
    wave: 'square',
    lead: '12 . 16 . 19 . 16 . 14 . 12 . 9 . 12 . 16 . 19 . 21 . 19 . 16 - 14 - 12 - - .',
    bass: '0 . 0 7 0 . 0 7 5 . 5 12 5 . 5 12 7 . 7 14 7 . 7 14 0 . 0 7 0 . 7 .',
    drums: 'k . h . s . h h k . h . s . h . k . h . s . h h k k h . s . h .',
  },
  bgm_world2: {
    bpm: 112,
    root: 57,
    wave: 'triangle',
    lead: '12 . 15 . 17 . 15 . 12 . 10 . 7 - - . 12 . 15 . 19 . 17 . 15 - 12 - 10 - - .',
    bass: '0 . . 7 . . 0 . 5 . . 12 . . 5 . 3 . . 10 . . 3 . 7 . . 14 . . 7 .',
    drums: 'k . . h s . h . k . . h s . h . k . . h s . h . k . h h s . h .',
  },
  bgm_world3: {
    bpm: 120,
    root: 65,
    wave: 'square',
    lead: '7 9 12 . 9 7 4 . 5 7 9 . 7 5 2 . 7 9 12 . 14 12 9 . 7 - 4 - 0 - - .',
    bass: '0 . 7 . 4 . 7 . 5 . 9 . 0 . 9 . 0 . 7 . 4 . 7 . 7 . 2 . 7 . 0 .',
    drums: 'k h s h k h s h k h s h k h s h k h s h k h s h k k s h k h s s',
  },
  // Night (World 4): slower, minor and soft, like a walk home in the dark.
  bgm_world4: {
    bpm: 96,
    root: 57,
    wave: 'triangle',
    lead: '7 . 10 . 12 . 15 - 14 . 12 . 10 - - . 7 . 10 . 12 . 10 . 7 - 5 - 3 - - .',
    bass: '0 . . . 7 . . . 3 . . . 10 . . . 5 . . . 12 . . . 7 . . . 2 . . .',
    drums: 'k . . . h . . . s . . . h . . . k . . . h . . . s . . . h . h .',
  },
  // Island (World 5): a lilting major-pentatonic tune with a little lift on the off-beats, like a breeze off the sea.
  bgm_world5: {
    bpm: 108,
    root: 60,
    wave: 'triangle',
    lead: '12 . 9 . 7 . 9 12 . 14 12 . 9 . 7 . 4 . 7 9 . 7 4 . 2 . 4 - 0 - - .',
    bass: '0 . 7 . 0 . 7 . 5 . 12 . 5 . 12 . 9 . 4 . 9 . 4 . 7 . 2 . 7 . 0 .',
    drums: 'k . h . s . h h k . h . s . h . k . h . s . h h k . h k s . h .',
  },
  // The big hunt (World 6): a brisk minor march through the tall grass, the drums pushing on.
  bgm_world6: {
    bpm: 124,
    root: 55,
    wave: 'square',
    lead: '12 . 10 12 15 . 12 . 10 . 7 . 8 . 10 . 12 . 10 12 15 . 17 . 15 - 12 . 10 - - .',
    bass: '0 . 0 . 7 . 0 . 5 . 5 . 3 . 5 . 0 . 0 . 7 . 0 . 3 . 5 . 7 . 7 .',
    drums: 'k . h k s . h . k . h k s . h h k . h k s . h . k k h k s s h s',
  },
  bgm_boss: {
    bpm: 140,
    root: 52,
    wave: 'sawtooth',
    lead: '12 . 12 13 12 . 10 . 12 . 12 13 15 . 13 . 12 . 12 13 12 . 10 . 8 . 7 . 5 . 3 .',
    bass: '0 0 . 0 0 . 0 . 0 0 . 0 1 . 1 . 0 0 . 0 0 . 0 . -2 -2 . -2 -4 . -4 .',
    drums: 'k . h k s . h . k . h k s . h h k . h k s . h . k k h k s s h s',
  },
};

const parse = (s: string) => s.split(/\s+/).filter(Boolean);

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private last = new Map<string, number>();
  private sfxVol = 0.8;
  private bgmVol = 0.6;
  private musicId: string | null = null;
  private wantMusic: string | null = null;
  private seqTimer: number | null = null;
  private fileSource: AudioBufferSourceNode | null = null;
  private step = 0;
  private nextTime = 0;
  muted = false;

  /** Open the audio context, if it is not open yet. Opening it takes a moment (a third of a second on some
   *  computers), so the game does it while it loads rather than in the first tap; it stays silent until a user
   *  gesture unlocks it. */
  prepare(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.sfxBus = this.ctx.createGain();
    this.bgmBus = this.ctx.createGain();
    this.sfxBus.connect(this.ctx.destination);
    this.bgmBus.connect(this.ctx.destination);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.wantMusic) this.playMusic(this.wantMusic);
  }

  /** Must be called from a user gesture at least once (iOS). */
  unlock(): void {
    this.prepare();
    if (!this.ctx || this.ctx.state !== 'suspended') return;
    // A context opened before any gesture needs the gesture's resume; iOS also likes a sound started in the gesture
    // itself, so a silent one plays too.
    void this.ctx.resume();
    try {
      const kick = this.ctx.createBufferSource();
      kick.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      kick.connect(this.ctx.destination);
      kick.start(0);
    } catch {
      /* the resume alone will do */
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolumes(sfx: number, bgm: number): void {
    this.sfxVol = sfx;
    this.bgmVol = bgm;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.sfxBus || !this.bgmBus) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : this.sfxVol, t, 0.02);
    this.bgmBus.gain.setTargetAtTime(this.muted ? 0 : this.bgmVol * 0.55, t, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------ files

  private async buffer(id: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(id)) return this.buffers.get(id) ?? null;
    const url = fileFor(id);
    if (!url || !this.ctx) {
      this.buffers.set(id, null);
      return null;
    }
    this.buffers.set(id, null);
    try {
      const res = await fetch(url);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(id, buf);
      return buf;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ synth voices

  private tone(t: number, v: Voice, bus: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const start = t + (v.delay ?? 0);
    o.type = v.type ?? 'sine';
    o.frequency.setValueAtTime(v.freq, start);
    if (v.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, v.to), start + v.dur);
    const peak = v.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + (v.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);
    o.connect(g).connect(bus);
    o.start(start);
    o.stop(start + v.dur + 0.05);
  }

  private noise(t: number, n: Noise, bus: AudioNode): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = n.kind ?? 'bandpass';
    const start = t + (n.delay ?? 0);
    f.frequency.setValueAtTime(n.filter ?? 1500, start);
    if (n.to) f.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
    f.Q.value = n.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(n.gain ?? 0.2, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    src.connect(f).connect(g).connect(bus);
    src.start(start, Math.random() * 0.5);
    src.stop(start + n.dur + 0.05);
  }

  private synth(id: string, t: number, bus: AudioNode, pitch: number): boolean {
    const T = (v: Voice) => this.tone(t, { ...v, freq: v.freq * pitch, to: v.to ? v.to * pitch : undefined }, bus);
    const N = (n: Noise) => this.noise(t, n, bus);
    switch (id) {
      case 'sfx_tap':
        T({ freq: 880, to: 1100, dur: 0.05, gain: 0.12 });
        return true;
      case 'sfx_card':
        T({ freq: 660, to: 990, dur: 0.07, type: 'triangle', gain: 0.22 });
        return true;
      case 'sfx_cancel':
        T({ freq: 620, to: 400, dur: 0.08, type: 'triangle', gain: 0.18 });
        return true;
      case 'sfx_place':
        T({ freq: 300, to: 620, dur: 0.1, gain: 0.32 });
        T({ freq: 980, dur: 0.06, gain: 0.1, delay: 0.05 });
        return true;
      case 'sfx_shovel':
        N({ dur: 0.12, kind: 'lowpass', filter: 1400, gain: 0.25 });
        T({ freq: 240, to: 150, dur: 0.12, type: 'triangle', gain: 0.18 });
        return true;
      case 'sfx_sprout':
        T({ freq: 520, to: 820, dur: 0.12, gain: 0.08 });
        return true;
      case 'sfx_pull':
        N({ dur: 0.05, filter: 2200, gain: 0.14 });
        T({ freq: 700, to: 1400, dur: 0.08, type: 'triangle', gain: 0.22 });
        return true;
      case 'sfx_jab':
        N({ dur: 0.05, kind: 'highpass', filter: 3200, gain: 0.16 });
        T({ freq: 420, to: 260, dur: 0.06, type: 'square', gain: 0.05 });
        return true;
      case 'sfx_blast':
        N({ dur: 0.22, kind: 'lowpass', filter: 1000, to: 260, gain: 0.32 });
        T({ freq: 160, to: 60, dur: 0.22, gain: 0.3 });
        return true;
      case 'sfx_throw':
        N({ dur: 0.08, filter: 1600, gain: 0.1 });
        return true;
      case 'sfx_hit':
        N({ dur: 0.04, filter: 2600, gain: 0.12 });
        T({ freq: 320, to: 200, dur: 0.04, gain: 0.08 });
        return true;
      case 'sfx_clink':
        T({ freq: 2100, dur: 0.07, type: 'square', gain: 0.05 });
        T({ freq: 2700, dur: 0.05, type: 'square', gain: 0.04, delay: 0.02 });
        return true;
      case 'sfx_bite':
        T({ freq: 210, to: 120, dur: 0.06, type: 'square', gain: 0.06 });
        return true;
      case 'sfx_spit':
        T({ freq: 480, to: 920, dur: 0.09, gain: 0.14 });
        N({ dur: 0.05, filter: 3000, gain: 0.06 });
        return true;
      case 'sfx_stomp':
        T({ freq: 90, to: 38, dur: 0.38, gain: 0.55 });
        N({ dur: 0.3, kind: 'lowpass', filter: 320, gain: 0.45 });
        return true;
      case 'sfx_collapse_ally':
        T({ freq: 620, to: 300, dur: 0.26, type: 'triangle', gain: 0.16 });
        return true;
      case 'sfx_collapse_enemy':
        T({ freq: 420, to: 190, dur: 0.18, type: 'triangle', gain: 0.14 });
        N({ dur: 0.1, filter: 900, gain: 0.08 });
        return true;
      case 'sfx_song':
        [0, 4, 7, 12].forEach((s, i) => T({ freq: n2f(72 + s), dur: 0.22, gain: 0.08, delay: i * 0.12 }));
        return true;
      case 'sfx_heal':
        T({ freq: 820, to: 1240, dur: 0.18, gain: 0.07 });
        return true;
      case 'sfx_claws':
        // The chimera drawing her claws: a quick metallic slide out, then a glint.
        N({ dur: 0.18, kind: 'highpass', filter: 2400, to: 6500, gain: 0.14 });
        T({ freq: 1300, to: 2600, dur: 0.14, type: 'triangle', gain: 0.07 });
        T({ freq: 3100, dur: 0.12, gain: 0.05, delay: 0.16 });
        return true;
      case 'sfx_splash':
        // A can bursting where it lands: a wet slosh, falling.
        N({ dur: 0.26, kind: 'lowpass', filter: 2600, to: 420, gain: 0.26 });
        T({ freq: 340, to: 130, dur: 0.14, type: 'triangle', gain: 0.1 });
        return true;
      case 'sfx_transform':
        T({ freq: 180, to: 1300, dur: 0.9, type: 'sawtooth', gain: 0.08 });
        N({ dur: 0.9, kind: 'lowpass', filter: 400, to: 4000, gain: 0.12 });
        return true;
      case 'sfx_car':
        T({ freq: 440, dur: 0.14, type: 'square', gain: 0.08 });
        T({ freq: 554, dur: 0.16, type: 'square', gain: 0.08, delay: 0.16 });
        N({ dur: 0.5, kind: 'lowpass', filter: 500, gain: 0.12 });
        return true;
      case 'sfx_wave':
        T({ freq: 330, dur: 0.24, type: 'sawtooth', gain: 0.07 });
        T({ freq: 392, dur: 0.4, type: 'sawtooth', gain: 0.07, delay: 0.24 });
        return true;
      case 'sfx_boss':
        T({ freq: 110, dur: 0.7, type: 'sawtooth', gain: 0.08 });
        T({ freq: 82, dur: 0.9, type: 'sawtooth', gain: 0.08, delay: 0.25 });
        return true;
      case 'sfx_win':
        [0, 4, 7, 12, 16].forEach((s, i) => T({ freq: n2f(72 + s), dur: 0.26, type: 'triangle', gain: 0.18, delay: i * 0.1 }));
        return true;
      case 'sfx_lose':
        [7, 4, 0, -5].forEach((s, i) => T({ freq: n2f(67 + s), dur: 0.32, type: 'triangle', gain: 0.16, delay: i * 0.18 }));
        return true;
      case 'sfx_unlock':
        [0, 7, 12, 19, 24].forEach((s, i) => T({ freq: n2f(76 + s), dur: 0.2, gain: 0.1, delay: i * 0.07 }));
        return true;
      case 'sfx_coin':
        T({ freq: 988, dur: 0.07, type: 'square', gain: 0.06 });
        T({ freq: 1319, dur: 0.16, type: 'square', gain: 0.06, delay: 0.07 });
        return true;
      case 'sfx_stamp':
        // A soft wooden thud with a little click as the rubber meets the paper.
        T({ freq: 150, to: 70, dur: 0.14, gain: 0.34 });
        N({ dur: 0.07, kind: 'lowpass', filter: 700, gain: 0.22 });
        T({ freq: 1700, dur: 0.025, type: 'triangle', gain: 0.05 });
        return true;
      default:
        return false;
    }
  }

  /** Play a sound effect. Rate-limited per id so hordes do not turn into noise. */
  sfx(id: string, opts: { pitch?: number; gap?: number } = {}): void {
    if (!this.ctx || !this.sfxBus || this.muted || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const gap = opts.gap ?? 0.035;
    if ((this.last.get(id) ?? -1) > now - gap) return;
    this.last.set(id, now);
    const pitch = opts.pitch ?? 1;
    if (fileFor(id)) {
      void this.buffer(id).then((buf) => {
        if (!buf || !this.ctx || !this.sfxBus) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = pitch;
        src.connect(this.sfxBus);
        src.start();
      });
      return;
    }
    this.synth(id, now, this.sfxBus, pitch);
  }

  // ------------------------------------------------------------ music

  playMusic(id: string): void {
    this.wantMusic = id;
    if (!this.ctx || !this.bgmBus) return;
    if (this.musicId === id) return;
    this.stopMusic(false);
    this.musicId = id;
    if (fileFor(id)) {
      void this.buffer(id).then((buf) => {
        if (!buf || !this.ctx || !this.bgmBus || this.musicId !== id) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(this.bgmBus);
        src.start();
        this.fileSource = src;
      });
      return;
    }
    const track = TRACKS[id];
    if (!track) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    const lead = parse(track.lead);
    const bass = parse(track.bass);
    const drums = parse(track.drums);
    const stepDur = 60 / track.bpm / 2;
    const tick = () => {
      if (!this.ctx || !this.bgmBus || this.musicId !== id) return;
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        const i = this.step % lead.length;
        const holdLen = (arr: string[], at: number) => {
          let n = 1;
          while (arr[(at + n) % arr.length] === '-' && n < 8) n++;
          return n;
        };
        const l = lead[i];
        if (l !== '.' && l !== '-') {
          this.tone(this.nextTime, { freq: n2f(track.root + Number(l)), dur: stepDur * holdLen(lead, i) * 0.95, type: track.wave, gain: track.wave === 'sawtooth' ? 0.05 : track.wave === 'square' ? 0.06 : 0.11 }, this.bgmBus);
        }
        const b = bass[i % bass.length];
        if (b && b !== '.' && b !== '-') {
          this.tone(this.nextTime, { freq: n2f(track.root - 12 + Number(b)), dur: stepDur * holdLen(bass, i % bass.length) * 0.9, type: 'triangle', gain: 0.16 }, this.bgmBus);
        }
        const d = drums[i % drums.length];
        if (d === 'k') this.tone(this.nextTime, { freq: 120, to: 48, dur: 0.12, gain: 0.32 }, this.bgmBus);
        else if (d === 's') this.noise(this.nextTime, { dur: 0.09, filter: 1800, gain: 0.1 }, this.bgmBus);
        else if (d === 'h') this.noise(this.nextTime, { dur: 0.03, kind: 'highpass', filter: 7000, gain: 0.05 }, this.bgmBus);
        this.nextTime += stepDur;
        this.step++;
      }
    };
    tick();
    this.seqTimer = window.setInterval(tick, 25);
  }

  stopMusic(clearWanted = true): void {
    if (clearWanted) this.wantMusic = null;
    this.musicId = null;
    if (this.seqTimer !== null) {
      window.clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    if (this.fileSource) {
      try {
        this.fileSource.stop();
      } catch {
        /* already stopped */
      }
      this.fileSource = null;
    }
  }

  hasFile(id: string): boolean {
    return !!fileFor(id);
  }
}

export const audio = new AudioManager();
