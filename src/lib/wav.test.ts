import { describe, expect, it } from "vitest";
import { concat, downsample, encodeWav, rms } from "@/lib/wav";

describe("WAV (#132)", () => {
  it("schreibt einen gültigen PCM-Kopf und begrenzt die Werte", () => {
    const buffer = encodeWav(new Float32Array([0, 1, -1, 2]), 16_000);
    const v = new DataView(buffer);
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(buffer, o, 4));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });

  it("rechnet 48 kHz auf 16 kHz herunter", () => {
    const input = new Float32Array(48_000).fill(0.5);
    const out = downsample(input, 48_000);
    expect(out.length).toBe(16_000);
    expect(out[100]).toBeCloseTo(0.5);
    expect(downsample(input, 16_000)).toBe(input);
  });

  it("misst die Lautstärke und hängt Stücke aneinander", () => {
    expect(rms(new Float32Array([0, 0]))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(Array.from(concat([new Float32Array([1]), new Float32Array([2, 3])]))).toEqual([
      1, 2, 3,
    ]);
  });
});
