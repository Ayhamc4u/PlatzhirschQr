import { headers } from "next/headers";

import connectDB from "#utils/database/connect";
import { Tables } from "#utils/database/models/table";

import QrCodePrintView from "./QrCodePrintView";
import "./qrCodes.scss";

export const dynamic = "force-dynamic";

type TQrTable = {
	_id: { toString(): string };
	name: string;
	username: string;
	qrToken?: string;
	ready2orderTableId?: number;
};

const PICKUP_TABLE_PATTERN = /^abh\s*(?:10|[1-9])$/i;

async function getRequestOrigin() {
	const requestHeaders = await headers();
	const forwardedHost = requestHeaders.get("x-forwarded-host");
	const host = forwardedHost || requestHeaders.get("host") || "localhost:3050";
	const forwardedProto = requestHeaders.get("x-forwarded-proto");
	const protocol = forwardedProto || (host.startsWith("localhost") ? "http" : "https");

	return `${protocol}://${host}`.replace(/\/$/, "");
}

export const metadata = {
	title: "Platzhirsch • Tisch QR-Codes",
};

export default async function QrCodesPage() {
	const restaurantID = process.env.RESTAURANT_ID || "platzhirsch";
	const requestOrigin = await getRequestOrigin();

	await connectDB();

	const tableDocuments = await Tables.find({
		restaurantID,
		qrToken: { $exists: true, $ne: "" },
	})
		.select("name username qrToken ready2orderTableId")
		.lean<TQrTable[]>();

	const tables = tableDocuments
		.filter((table) => !PICKUP_TABLE_PATTERN.test(table.name))
		.filter((table) => Boolean(table.qrToken))
		.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true, sensitivity: "base" }))
		.map((table) => ({
			id: table._id.toString(),
			name: table.name,
			ready2orderTableId: table.ready2orderTableId,
			qrUrl: `${requestOrigin}/q/${encodeURIComponent(table.qrToken as string)}`,
		}));

	return <QrCodePrintView restaurantID={restaurantID} tables={tables} />;
}
