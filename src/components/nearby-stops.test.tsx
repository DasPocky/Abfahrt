import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StopSearchResponse } from "../../shared/api-types";
import { LOCATION_PREF_KEY } from "@/hooks/use-location";
import { renderAt, requestUrl } from "../test-utils";

const HERE = { lat: 51.22641, lon: 6.77682 };

const NEARBY: StopSearchResponse = {
  stops: [
    {
      id: "vrr:de:05111:18287",
      name: "Benrather Straße U",
      place: "Düsseldorf",
      lat: 51.22306,
      lon: 6.77559,
    },
    {
      id: "vrr:de:05111:18036",
      name: "Heinrich-Heine-Allee U",
      place: "Düsseldorf",
      lat: 51.2264,
      lon: 6.77683,
    },
    {
      id: "vrr:de:05111:18145",
      name: "Carlsplatz",
      place: "Düsseldorf",
      lat: 51.22307,
      lon: 6.77445,
    },
    {
      id: "vrr:de:05111:18230",
      name: "Schadowstraße U",
      place: "Düsseldorf",
      lat: 51.22662,
      lon: 6.78339,
    },
    {
      id: "vrr:de:05111:18144",
      name: "Maxplatz",
      place: "Düsseldorf",
      lat: 51.22324,
      lon: 6.77188,
    },
  ],
};

const COORDS: GeolocationCoordinates = {
  latitude: HERE.lat,
  longitude: HERE.lon,
  accuracy: 30,
  altitude: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null,
  toJSON: () => ({}),
};

const DENIED: GeolocationPositionError = {
  code: 1,
  message: "denied",
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

function mockGeolocation(result: "ok" | "denied") {
  const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((ok, fail) => {
    if (result === "ok") ok({ coords: COORDS, timestamp: Date.now(), toJSON: () => ({}) });
    else fail?.(DENIED);
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("In der Nähe", () => {
  it("fordert den Standort beim Öffnen an und zeigt die nächsten Haltestellen", async () => {
    const geo = mockGeolocation("ok");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(NEARBY));
    renderAt("/");
    expect(geo).toHaveBeenCalled();

    const list = await screen.findByRole("list", { name: "Haltestellen in der Nähe" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveTextContent("Heinrich-Heine-Allee U");
    expect(links[0]).toHaveTextContent("50 m");
    expect(links[0]).toHaveAttribute("href", "/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18036");

    // Position nur gerundet (~100 m) an den Worker
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/stops/nearby");
    expect(url.searchParams.get("lat")).toBe("51.226");
    expect(url.searchParams.get("lon")).toBe("6.777");
    expect(localStorage.getItem(LOCATION_PREF_KEY)).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: "Alle 5 anzeigen" }));
    expect(within(list).getAllByRole("link")).toHaveLength(5);
  });

  it("lädt bei gemerkter Freigabe direkt", async () => {
    localStorage.setItem(LOCATION_PREF_KEY, "on");
    mockGeolocation("ok");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(NEARBY));
    renderAt("/");
    expect(
      await screen.findByRole("list", { name: "Haltestellen in der Nähe" }),
    ).toBeInTheDocument();
  });

  it("fragt nicht, wenn der Standort selbst ausgeschaltet wurde", () => {
    localStorage.setItem(LOCATION_PREF_KEY, "off");
    const geo = mockGeolocation("ok");
    renderAt("/");
    expect(geo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /in meiner Nähe/ }));
    expect(geo).toHaveBeenCalledTimes(1);
  });

  it("meldet einen verweigerten Standort und fragt beim nächsten Öffnen wieder", () => {
    const geo = mockGeolocation("denied");
    const { unmount } = renderAt("/");
    const nearby = screen.getByRole("region", { name: "In der Nähe" });
    expect(within(nearby).getByText(/Standort nicht freigegeben/)).toBeInTheDocument();
    expect(
      within(nearby).getByRole("button", { name: "So gibst du ihn frei" }),
    ).toBeInTheDocument();
    // Ablehnung wird nicht dauerhaft gemerkt
    expect(localStorage.getItem(LOCATION_PREF_KEY)).toBeNull();
    unmount();
    renderAt("/");
    expect(geo).toHaveBeenCalledTimes(2);
  });

  it("holt den Standort, sobald er in den Einstellungen freigegeben wird", async () => {
    let allowed = false;
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((ok, fail) => {
      if (allowed) ok({ coords: COORDS, timestamp: Date.now(), toJSON: () => ({}) });
      else fail?.(DENIED);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    const listeners: (() => void)[] = [];
    const permission = {
      state: "denied",
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: () => {},
    };
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => permission },
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(NEARBY));

    renderAt("/");
    expect((await screen.findAllByText(/Standort nicht freigegeben/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(listeners).toHaveLength(1));

    allowed = true;
    permission.state = "granted";
    act(() => listeners.forEach((listener) => listener()));
    expect(
      await screen.findByRole("list", { name: "Haltestellen in der Nähe" }),
    ).toBeInTheDocument();
    Reflect.deleteProperty(navigator, "permissions");
  });
});
