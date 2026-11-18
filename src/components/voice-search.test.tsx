import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt, requestUrl } from "../test-utils";

// Aufnahme im Browser nachbilden: liefert sofort eine (leere) WAV
vi.mock("@/hooks/use-voice-recorder", () => ({
  voiceSupported: () => true,
  useVoiceRecorder: () => ({
    listening: false,
    stop: () => {},
    record: async () => ({ kind: "audio", wav: new ArrayBuffer(44) }),
  }),
}));

const BENRATH = { id: "vrr:de:05111:18694", name: "Benrath S", place: "Düsseldorf" };
const ESSEN = { id: "vrr:de:05113:9289", name: "Essen Hbf", place: "Essen" };

function mockApi(speech: unknown = { text: "Von Benrath nach Essen Hbf." }, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input);
    if (url.pathname.endsWith("/speech")) return Response.json(speech, { status });
    if (url.pathname.endsWith("/stops/search")) {
      const q = url.searchParams.get("q") ?? "";
      return Response.json({ stops: q.startsWith("Benrath") ? [BENRATH] : [ESSEN] });
    }
    return new Promise(() => {});
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Spracheingabe (#132)", () => {
  it("fragt beim ersten Mal um Einwilligung, Abbrechen nimmt nichts auf", () => {
    const fetchMock = mockApi();
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Wunsch sprechen" }));
    expect(screen.getByRole("group", { name: "Spracheingabe" })).toHaveTextContent("Cloudflare");
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("group", { name: "Spracheingabe" })).toBeNull();
    expect(localStorage.getItem("abfahrt:voice-consent")).toBeNull();
    expect(fetchMock.mock.calls.some((c) => requestUrl(c[0]).pathname.endsWith("/speech"))).toBe(
      false,
    );
  });

  it("erkennt den Wunsch und öffnet die Verbindung", async () => {
    const fetchMock = mockApi();
    const { router } = renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Wunsch sprechen" }));
    fireEvent.click(screen.getByRole("button", { name: "Einverstanden" }));
    expect(localStorage.getItem("abfahrt:voice-consent")).toBe("1");

    await waitFor(() => expect(router.state.location.pathname).toBe("/abfahrt/verbindung"));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("von")).toBe(BENRATH.id);
    expect(params.get("nach")).toBe(ESSEN.id);
    const speech = fetchMock.mock.calls.find((c) => requestUrl(c[0]).pathname.endsWith("/speech"));
    expect(speech?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "audio/wav" }),
    });
  });

  it("meldet ein ausgeschöpftes Tageskontingent verständlich", async () => {
    localStorage.setItem("abfahrt:voice-consent", "1");
    mockApi({ error: "speech_quota" }, 429);
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Wunsch sprechen" }));
    expect(await screen.findByText(/für heute ausgelastet/)).toBeInTheDocument();
  });

  it("bietet einen getippten Satz als Verbindung an (#131)", async () => {
    mockApi();
    const { router } = renderAt("/");
    fireEvent.change(screen.getByRole("searchbox", { name: "Haltestelle suchen" }), {
      target: { value: "von Benrath nach Essen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verbindung suchen: Benrath → Essen" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/abfahrt/verbindung"));
  });
});
