"use client";

import { useEffect, useMemo, useState } from "react";

import { useAdmin } from "#components/context/useContext";
import type { TTable } from "#utils/database/models/table";

import QrCodePrintView from "../qr-codes/QrCodePrintView";

const PICKUP_TABLE_PATTERN = /^abh\s*(?:10|[1-9])$/i;

type TAdminTable = TTable & {
	_id?: string;
};

const TablesQrOverview = () => {
	const { tables } = useAdmin();
	const [origin, setOrigin] = useState("");

	useEffect(() => {
		setOrigin(window.location.origin);
	}, []);

	const qrTables = useMemo(() => {
		if (!origin) return [];

		return (tables as TAdminTable[])
			.filter((table) => !PICKUP_TABLE_PATTERN.test(table.name))
			.filter((table) => Boolean(table.qrToken))
			.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true, sensitivity: "base" }))
			.map((table) => ({
				id: table._id?.toString() || table.username,
				name: table.name,
				ready2orderTableId: table.ready2orderTableId,
				qrUrl: `${origin}/q/${encodeURIComponent(table.qrToken as string)}`,
			}));
	}, [origin, tables]);

	return <QrCodePrintView tables={qrTables} embedded />;
};

export default TablesQrOverview;
