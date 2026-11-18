// Aufnahme → WAV (#132): 16 kHz, mono, 16 Bit PCM. Das versteht Whisper überall gleich, anders als
// die Formate von MediaRecorder (Safari: MP4/AAC, Chrome: WebM/Opus). Rein und getestet.

export const TARGET_RATE = 16_000;

/** Auf `outRate` herunterrechnen (Mittelwert je Ziel-Sample, wirkt zugleich als Tiefpass) */
export function downsample(
  input: Float32Array,
  inRate: number,
  outRate = TARGET_RATE,
): Float32Array {
  if (inRate === outRate) return input;
  if (inRate < outRate) throw new Error("Hochrechnen wird nicht unterstützt");
  const ratio = inRate / outRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate = TARGET_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true); // Größe des fmt-Blocks
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Bytes je Sekunde
  view.setUint16(32, 2, true); // Bytes je Sample
  view.setUint16(34, 16, true); // Bit je Sample
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return buffer;
}

/** Lautstärke eines Abschnitts (RMS, 0–1) für die Erkennung von Sprechpausen */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export function concat(chunks: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
