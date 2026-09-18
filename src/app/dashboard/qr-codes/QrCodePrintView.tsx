"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

import "./qrCodes.scss";

type TQrCode = {
	addData(value: string): void;
	make(): void;
	createSvgTag(options: {
		cellSize: number;
		margin: number;
		scalable: boolean;
	}): string;
};

declare global {
	interface Window {
		qrcode?: (typeNumber: number, errorCorrectionLevel: "L" | "M" | "Q" | "H") => TQrCode;
	}
}

type TTableQr = {
	id: string;
	name: string;
	ready2orderTableId?: number;
	qrUrl: string;
};

type TProps = {
	restaurantID?: string;
	tables: TTableQr[];
	embedded?: boolean;
};

function renderQrSvg(url: string) {
	if (typeof window === "undefined" || !window.qrcode) return "";

	const qr = window.qrcode(0, "M");
	qr.addData(url);
	qr.make();

	return qr.createSvgTag({
		cellSize: 8,
		margin: 4,
		scalable: true,
	});
}

export default function QrCodePrintView({ restaurantID, tables, embedded = false }: TProps) {
	const [qrReady, setQrReady] = useState(false);
	const [qrLoadError, setQrLoadError] = useState(false);
	const [filter, setFilter] = useState("");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const selectionInitialized = useRef(false);

	useEffect(() => {
		if (!selectionInitialized.current && tables.length > 0) {
			setSelectedIds(tables.map((table) => table.id));
			selectionInitialized.current = true;
			return;
		}

		setSelectedIds((current) => current.filter((id) => tables.some((table) => table.id === id)));
	}, [tables]);

	const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const selectedTables = useMemo(() => tables.filter((table) => selectedIdSet.has(table.id)), [selectedIdSet, tables]);
	const filteredTables = useMemo(() => {
		const normalizedFilter = filter.trim().toLocaleLowerCase("de");
		if (!normalizedFilter) return tables;
		return tables.filter((table) => table.name.toLocaleLowerCase("de").includes(normalizedFilter));
	}, [filter, tables]);

	const renderedQrs = useMemo(() => {
		if (!qrReady) return new Map<string, string>();
		return new Map(tables.map((table) => [table.id, renderQrSvg(table.qrUrl)]));
	}, [qrReady, tables]);

	const toggleTable = (tableId: string) => {
		setSelectedIds((current) => (current.includes(tableId) ? current.filter((id) => id !== tableId) : [...current, tableId]));
	};

	const selectAll = () => setSelectedIds(tables.map((table) => table.id));
	const clearSelection = () => setSelectedIds([]);

	return (
		<>
			<Script
				src="https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js"
				strategy="afterInteractive"
				onReady={() => setQrReady(Boolean(window.qrcode))}
				onError={() => setQrLoadError(true)}
			/>

			<main className={`qrPrintPage ${embedded ? "embedded" : ""}`}>
				<header className="qrPrintToolbar noPrint">
					<div>
						<p className="qrPrintEyebrow">Platzhirsch Admin</p>
						<h1>Tisch QR-Codes</h1>
						<p>
							{tables.length} Tisch{tables.length === 1 ? "" : "e"}
							{restaurantID ? <> für <strong>{restaurantID}</strong></> : null}
						</p>
					</div>

					<div className="qrPrintActions">
						{!embedded ? (
							<Link href="/dashboard?tab=tables" className="qrSecondaryButton">
								Zurück zum Dashboard
							</Link>
						) : null}
						<button
							type="button"
							className="qrPrimaryButton"
							disabled={!qrReady || selectedTables.length === 0}
							onClick={() => window.print()}
						>
							{selectedTables.length} QR-Code{selectedTables.length === 1 ? "" : "s"} drucken
						</button>
					</div>
				</header>

				{tables.length > 0 ? (
					<section className="qrTableFilter noPrint" aria-label="Tische zum Drucken auswählen">
						<div className="qrFilterHeader">
							<label htmlFor="qr-table-filter">Tische auswählen</label>
							<span>{selectedTables.length} von {tables.length} ausgewählt</span>
						</div>
						<div className="qrFilterControls">
							<input
								id="qr-table-filter"
								type="search"
								value={filter}
								onChange={(event) => setFilter(event.target.value)}
								placeholder="Tisch suchen …"
							/>
							<button type="button" onClick={selectAll}>Alle auswählen</button>
							<button type="button" onClick={clearSelection}>Auswahl löschen</button>
						</div>
						<div className="qrTableChoices">
							{filteredTables.map((table) => (
								<label className={selectedIdSet.has(table.id) ? "selected" : ""} key={table.id}>
									<input
										type="checkbox"
										checked={selectedIdSet.has(table.id)}
										onChange={() => toggleTable(table.id)}
									/>
									<span>{table.name}</span>
								</label>
							))}
							{filteredTables.length === 0 ? <p>Kein Tisch passt zum Filter.</p> : null}
						</div>
					</section>
				) : null}

				{!qrReady && !qrLoadError && tables.length > 0 ? (
					<p className="qrLoading noPrint">QR-Codes werden vorbereitet …</p>
				) : null}

				{qrLoadError ? (
					<section className="qrEmpty noPrint">
						<h2>QR-Generator konnte nicht geladen werden</h2>
						<p>Bitte Internetverbindung prüfen und die Seite neu laden.</p>
					</section>
				) : null}

				{tables.length === 0 ? (
					<section className="qrEmpty noPrint">
						<h2>Keine druckbaren Tische gefunden</h2>
						<p>Es wurden keine Tische mit QR-Token gefunden. Bitte zuerst die ready2order-Tische synchronisieren.</p>
					</section>
				) : (
					<section className="qrGrid" aria-label="Tisch QR-Codes">
						{tables.map((table) => {
							const selected = selectedIdSet.has(table.id);
							return (
								<article className={`qrCard ${selected ? "selectedForPrint" : "notSelectedForPrint"}`} key={table.id}>
									<div className="qrBrand">PLATZHIRSCH</div>
									<div className="qrSubtitle">ZWETTL AN DER RODL</div>

									<div
										className="qrImage"
										aria-label={`QR-Code für ${table.name}`}
										dangerouslySetInnerHTML={{ __html: renderedQrs.get(table.id) || "" }}
									/>

									<h2>{table.name}</h2>
									<p className="qrInstruction">Scannen &amp; bestellen</p>
									<p className="qrHint">Bitte QR-Code am Tisch scannen.</p>
									<p className="qrUrl noPrint">{table.qrUrl}</p>
								</article>
							);
						})}
					</section>
				)}
			</main>
		</>
	);
}
