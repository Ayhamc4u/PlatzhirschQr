import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const url = searchParams.get("url");

	if (!url) {
		return NextResponse.json(
			{ message: "URL fehlt" },
			{ status: 400 },
		);
	}

	const qrBuffer = await QRCode.toBuffer(url, {
		type: "png",
		width: 800,
		margin: 2,
		errorCorrectionLevel: "H",
	});

	return new NextResponse(qrBuffer, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "no-store",
		},
	});
}
