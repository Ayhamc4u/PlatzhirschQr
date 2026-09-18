import crypto from "node:crypto";
import { NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { CustomerActivationTokens } from "#utils/database/models/customerActivationToken";
import { isEmailValid } from "#utils/helper/common";
import { sendHtmlEmail } from "#utils/helper/emailHelper";

const ACTIVATION_TTL_MINUTES = 30;
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function POST(req: Request) {
	const body = await req.json();
	const email = String(body?.email ?? "").trim().toLowerCase();
	const restaurant = String(body?.restaurant ?? "platzhirsch").trim().toLowerCase();
	if (!isEmailValid(email)) return NextResponse.json({ message: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });

	await connectDB();
	const generic = { status: 200, message: "Wir haben dir einen Aktivierungslink geschickt." };
	const recent = await CustomerActivationTokens.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60_000) } }).lean();
	if (recent) return NextResponse.json({ ...generic, ...(process.env.NODE_ENV !== "production" ? { developmentStatus: "rate-limited" } : {}) });

	const token = crypto.randomBytes(32).toString("hex");
	await CustomerActivationTokens.create({ email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ACTIVATION_TTL_MINUTES * 60_000) });

	const origin = new URL(req.url).origin;
	const link = `${origin}/${encodeURIComponent(restaurant)}/account/activate?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
	const sent = await sendHtmlEmail({
		to: email,
		subject: "Dein Platzhirsch Konto aktivieren",
		html: `<div style="font-family:Arial,sans-serif;color:#11100e"><h2>Willkommen beim Platzhirsch</h2><p>Bestätige deine E-Mail-Adresse, um dein Kundenkonto anzulegen.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#d9a441;color:#11100e;text-decoration:none;font-weight:700;border-radius:6px">E-Mail bestätigen</a></p><p>Der Link ist ${ACTIVATION_TTL_MINUTES} Minuten gültig.</p><p>Falls du das nicht angefordert hast, kannst du diese Nachricht ignorieren.</p></div>`,
	});
	if (!sent && process.env.NODE_ENV === "production") return NextResponse.json({ message: "E-Mail-Versand ist noch nicht konfiguriert." }, { status: 503 });

	const response: Record<string, unknown> = { ...generic };
	if (process.env.NODE_ENV !== "production") {
		response.developmentStatus = sent ? "sent" : "smtp-not-configured";
		if (!sent) response.developmentLink = link;
	}
	return NextResponse.json(response);
}

export const dynamic = "force-dynamic";
