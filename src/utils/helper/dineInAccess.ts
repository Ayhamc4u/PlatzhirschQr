const VENUE_HEADER = "x-platzhirsch-venue";

export type TDineInAccessMode = "development" | "wifi";

export function getDineInAccessMode(): TDineInAccessMode {
	return process.env.DINEIN_ACCESS_MODE === "wifi" ? "wifi" : "development";
}

export function hasDineInVenueAccess(request: Request) {
	if (getDineInAccessMode() === "development") return true;

	return request.headers.get(VENUE_HEADER) === "1";
}

export function requireDineInVenueAccess(request: Request) {
	if (hasDineInVenueAccess(request)) return;

	throw {
		status: 403,
		message: "Tischbestellungen sind nur im Platzhirsch Bestell-WLAN möglich.",
	};
}

export const DINE_IN_VENUE_HEADER = VENUE_HEADER;
