import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeakButton } from "@/components/speak-button";
import { setSettings, DEFAULT_SETTINGS } from "@/lib/settings";

class FakeUtterance extends EventTarget {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  constructor(text: string) {
    super();
    this.text = text;
  }
}

function installSpeech() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn<(u: FakeUtterance) => void>((u) => {
      spoken.push(u);
    }),
    cancel: vi.fn<() => void>(),
    getVoices: () => [
      { lang: "en-US", localService: true },
      { lang: "de-DE", localService: true, name: "Anna" },
    ],
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { synth, spoken };
}

afterEach(() => {
  Reflect.deleteProperty(window, "speechSynthesis");
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SpeakButton (#129)", () => {
  it("liest auf Deutsch im eingestellten Tempo vor und stoppt beim zweiten Tippen", () => {
    const { synth, spoken } = installSpeech();
    setSettings({ ...DEFAULT_SETTINGS, speechRate: "slow" });
    render(<SpeakButton label="Abfahrten vorlesen" text={() => "U 76 nach Holthausen."} />);

    fireEvent.click(screen.getByRole("button", { name: "Abfahrten vorlesen" }));
    expect(spoken[0]?.text).toBe("U 76 nach Holthausen.");
    expect(spoken[0]?.lang).toBe("de-DE");
    expect(spoken[0]?.rate).toBe(0.8);
    expect(spoken[0]?.voice).toMatchObject({ name: "Anna" });

    const stop = screen.getByRole("button", { name: "Vorlesen stoppen" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(stop);
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Abfahrten vorlesen" })).toBeInTheDocument();
  });

  it("fehlt, wenn der Browser keine Sprachausgabe hat", () => {
    render(<SpeakButton text={() => "x"} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
