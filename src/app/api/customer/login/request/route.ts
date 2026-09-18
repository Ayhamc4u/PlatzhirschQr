import crypto from "node:crypto";
import { NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { Customers } from "#utils/database/models/customer";
import { CustomerLoginCodes } from "#utils/database/models/customerLoginCode";
import { isEmailValid } from "#utils/helper/common";
import { sendHtmlEmail } from "#utils/helper/emailHelper";

const CODE_TTL_MINUTES = 10;
const hashCode = (email: string, code: string) => crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET || "platzhirsch-dev").update(`${email}:${code}`).digest("hex");

async function sendLoginCode(email: string, code: string) {
	return sendHtmlEmail({
		to: email,
		subject: "Dein Platzhirsch Anmeldecode",
		html: `<div style="font-family:Arial,sans-serif;color:#11100e"><h2>Dein Platzhirsch Anmeldecode</h2><p>Mit diesem Code meldest du dich bei deinem Platzhirsch-Konto an:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p><p>Der Code ist ${CODE_TTL_MINUTES} Minuten gültig.</p><p>Falls du diesen Code nicht angefordert hast, kannst du diese Nachricht ignorieren.</p></div>`,
	});
}

export async function POST(req: Request) {
	const email = String((await req.json())?.email ?? "").trim().toLowerCase();
	if (!isEmailValid(email)) return NextResponse.json({ message: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });

	await connectDB();
	const customer = await Customers.findOne({ email, accountEnabled: true, accountStatus: "ACTIVE" }).select("_id").lean();
	if (!customer) return NextResponse.json({ status: 200, message: "Falls ein Konto existiert, wurde ein Code versendet." });

	const recent = await CustomerLoginCodes.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60_000) } }).lean();
	if (recent) return NextResponse.json({ status: 200, message: "Falls ein Konto existiert, wurde ein Code versendet." });

	const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
	await CustomerLoginCodes.create({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) });

	const sent = await sendLoginCode(email, code);
	const response: Record<string, unknown> = { status: 200, message: "Falls ein Konto existiert, wurde ein Code versendet." };
	if (!sent && process.env.NODE_ENV !== "production") response.developmentCode = code;
	if (!sent && process.env.NODE_ENV === "production") return NextResponse.json({ message: "E-Mail-Versand ist noch nicht konfiguriert." }, { status: 503 });
	return NextResponse.json(response);
}

export const dynamic = "force-dynamic";
