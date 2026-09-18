import crypto from "node:crypto";
import { NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { CustomerActivationTokens } from "#utils/database/models/customerActivationToken";
import { Customers } from "#utils/database/models/customer";
import { isEmailValid } from "#utils/helper/common";
import { hashPassword } from "#utils/helper/passwordHelper";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function POST(req: Request) {
	const body = await req.json();
	const email = String(body?.email ?? "").trim().toLowerCase();
	const token = String(body?.token ?? "").trim();
	const password = String(body?.password ?? "");
	if (!isEmailValid(email) || !token) return NextResponse.json({ message: "Aktivierungslink ist ungültig." }, { status: 400 });
	if (password.length < 8) return NextResponse.json({ message: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });

	await connectDB();
	const activation = await CustomerActivationTokens.findOne({ email, tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
	if (!activation) return NextResponse.json({ message: "Der Aktivierungslink ist ungültig oder abgelaufen." }, { status: 400 });

	const customer = await Customers.findOne({ email, accountEnabled: true, accountStatus: "ACTIVE" }).select("+passwordHash");
	if (!customer) return NextResponse.json({ message: "Kundenkonto wurde nicht gefunden." }, { status: 404 });

	customer.passwordHash = await hashPassword(password);
	customer.emailVerifiedAt ??= new Date();
	customer.accountActivatedAt = new Date();
	await customer.save();
	activation.usedAt = new Date();
	await activation.save();

	return NextResponse.json({ status: 200, message: "Konto aktiviert. Du kannst dich jetzt mit deinem Passwort anmelden." });
}

export const dynamic = "force-dynamic";
