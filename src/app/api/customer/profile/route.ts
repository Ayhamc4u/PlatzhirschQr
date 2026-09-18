import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Customers } from "#utils/database/models/customer";
import { authOptions } from "#utils/helper/authHelper";

const NEWSLETTER_CONSENT_VERSION = "2026-09";
const PHONE_PATTERN = /^\+[0-9]{8,15}$/;

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions);
	const customerSession = session as typeof session & { role?: string; customer?: { _id?: string } };
	if (!customerSession || customerSession.role !== "customer" || !customerSession.customer?._id) {
		return NextResponse.json({ message: "Authentication Required" }, { status: 401 });
	}

	const body = await req.json();
	const fname = String(body?.fname ?? "").trim();
	const lname = String(body?.lname ?? "").trim();
	const phone = String(body?.phone ?? "").replace(/\s+/g, "");
	const newsletterOptIn = body?.newsletterOptIn === true;

	if (phone && !PHONE_PATTERN.test(phone)) return NextResponse.json({ message: "Bitte eine gültige Telefonnummer im Format +43... eingeben." }, { status: 400 });

	await connectDB();
	const customer = await Customers.findById(customerSession.customer._id);
	if (!customer) return NextResponse.json({ message: "Kundenkonto wurde nicht gefunden." }, { status: 404 });

	if (phone) {
		const phoneOwner = await Customers.findOne({ phone, _id: { $ne: customer._id } }).select("_id").lean();
		if (phoneOwner) return NextResponse.json({ message: "Diese Telefonnummer wird bereits verwendet." }, { status: 409 });
	}

	customer.fname = fname || undefined;
	customer.lname = lname || undefined;
	customer.phone = phone || undefined;
	customer.phoneNormalized = phone || undefined;
	customer.accountEnabled = true;

	const currentNewsletterStatus = customer.newsletter?.status ?? "NOT_REQUESTED";
	if (newsletterOptIn && currentNewsletterStatus !== "SUBSCRIBED") {
		customer.newsletter = {
			status: "PENDING",
			requestedAt: new Date(),
			consentVersion: NEWSLETTER_CONSENT_VERSION,
			source: "customer-account",
		};
	} else if (!newsletterOptIn && (currentNewsletterStatus === "PENDING" || currentNewsletterStatus === "SUBSCRIBED")) {
		customer.newsletter = {
			status: "UNSUBSCRIBED",
			requestedAt: customer.newsletter?.requestedAt,
			confirmedAt: customer.newsletter?.confirmedAt,
			unsubscribedAt: new Date(),
			consentVersion: customer.newsletter?.consentVersion,
			source: customer.newsletter?.source,
		};
	}

	await customer.save();

	return NextResponse.json({
		status: 200,
		customer: {
			fname: customer.fname ?? "",
			lname: customer.lname ?? "",
			phone: customer.phone ?? "",
			email: customer.email ?? "",
			newsletterStatus: customer.newsletter?.status ?? "NOT_REQUESTED",
		},
	});
}

export const dynamic = "force-dynamic";
