import { fireEvent, screen, within } from "@testing-library/react";
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
  it("fragt den Standort erst nach Antippen ab und zeigt die nächsten Haltestellen", async () => {
    const geo = mockGeolocation("ok");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(NEARBY));
    renderAt("/");
    expect(geo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /in meiner Nähe/ }));
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

  it("meldet einen verweigerten Standort", () => {
    mockGeolocation("denied");
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /in meiner Nähe/ }));
    expect(screen.getByText(/Standort nicht freigegeben/)).toBeInTheDocument();
    expect(localStorage.getItem(LOCATION_PREF_KEY)).toBe("off");
  });
});
