export const SITE_NAME = "Platzhirsch";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3050";

export const SITE_DESCRIPTION =
	"Beim Platzhirsch online zur Abholung bestellen oder vor Ort per QR-Code Speisen und Getränke direkt am Tisch bestellen.";

export const SITE_TAGLINE = "Einfach bestellen.";

export const SITE_KEYWORDS = [
	"Platzhirsch",
	"online bestellen",
	"Abholung",
	"Restaurant",
	"QR Bestellung",
	"digitale Speisekarte",
] as const;

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
