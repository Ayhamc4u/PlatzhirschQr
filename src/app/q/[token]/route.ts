import { NextRequest, NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { Tables } from "#utils/database/models/table";
import { hasDineInVenueAccess } from "#utils/helper/dineInAccess";

export const dynamic = "force-dynamic";

function getPublicOrigin(request: NextRequest) {
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
	const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();
	const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

	if (!host) {
		return new URL(request.url).origin;
	}

	const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");
	const protocol = forwardedProto || (isLocalhost ? "http" : "https");

	return `${protocol}://${host}`;
}

function wifiRequiredResponse() {
	return new Response(
		`<!doctype html>
<html lang="de">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Platzhirsch Bestell-WLAN erforderlich</title>
	<style>
		body{font-family:system-ui,-apple-system,sans-serif;background:#11100E;color:#F4F0E8;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
		main{max-width:520px;text-align:center}
		h1{font-size:2rem;margin:0 0 16px}
		p{font-size:1.05rem;line-height:1.55;margin:0 0 12px}
		strong{color:#D9A441}
	</style>
</head>
<body>
	<main>
		<h1>Bestell-WLAN erforderlich</h1>
		<p>Für Bestellungen am Tisch musst du mit dem <strong>Platzhirsch Bestell-WLAN</strong> verbunden sein.</p>
		<p>Verbinde dich mit dem WLAN und lade diesen QR-Code anschließend erneut.</p>
	</main>
</body>
</html>`,
		{
			status: 403,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
			},
		},
	);
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	const { token } = await params;
	const restaurantID = process.env.RESTAURANT_ID || "platzhirsch";
	const publicOrigin = getPublicOrigin(request);

	if (!token) {
		return NextResponse.redirect(new URL("/", publicOrigin), 307);
	}

	await connectDB();

	const table = await Tables.findOne({
		restaurantID,
		qrToken: token,
	})
		.select("restaurantID qrToken")
		.lean<{ restaurantID: string; qrToken: string } | null>();

	if (!table) {
		return NextResponse.redirect(new URL("/", publicOrigin), 307);
	}

	if (!hasDineInVenueAccess(request)) {
		return wifiRequiredResponse();
	}

	const target = new URL(`/${encodeURIComponent(table.restaurantID)}`, publicOrigin);
	target.searchParams.set("table", table.qrToken);

	return NextResponse.redirect(target, 307);
}
