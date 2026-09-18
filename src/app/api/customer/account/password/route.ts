import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { Customers } from "#utils/database/models/customer";
import { authOptions } from "#utils/helper/authHelper";
import { hashPassword } from "#utils/helper/passwordHelper";

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions);
	const customerSession = session as typeof session & { role?: string; customer?: { _id?: string } };
	if (!customerSession || customerSession.role !== "customer" || !customerSession.customer?._id) {
		return NextResponse.json({ message: "Authentication Required" }, { status: 401 });
	}

	const password = String((await req.json())?.password ?? "");
	if (password.length < 8) return NextResponse.json({ message: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });

	await connectDB();
	const customer = await Customers.findById(customerSession.customer._id).select("+passwordHash");
	if (!customer) return NextResponse.json({ message: "Kundenkonto wurde nicht gefunden." }, { status: 404 });
	if (!customer.emailVerifiedAt) return NextResponse.json({ message: "Bitte zuerst deine E-Mail-Adresse bestätigen." }, { status: 403 });

	customer.passwordHash = await hashPassword(password);
	customer.accountActivatedAt ??= new Date();
	await customer.save();

	return NextResponse.json({ status: 200, message: "Passwort gespeichert." });
}

export const dynamic = "force-dynamic";
