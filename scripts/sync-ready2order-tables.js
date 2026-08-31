require("dotenv").config({ path: ".env" });

const crypto = require("crypto");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
const ACCOUNT_TOKEN = process.env.READY2ORDER_ACCOUNT_TOKEN;
const RESTAURANT_ID = process.env.RESTAURANT_ID || "qrorder";

const API_BASE =
	process.env.READY2ORDER_API_BASE ||
	"https://api.ready2order.com/v1";

const PUBLIC_APP_URL =
	process.env.PUBLIC_APP_URL ||
	"http://localhost:3050";

if (!MONGODB_URI) {
	throw new Error("MONGODB_URI missing");
}

if (!ACCOUNT_TOKEN) {
	throw new Error("READY2ORDER_ACCOUNT_TOKEN missing");
}

const tableSchema = new mongoose.Schema(
	{},
	{
		strict: false,
		timestamps: true,
		collection: "tables",
	},
);

const Tables =
	mongoose.models.SyncTables ||
	mongoose.model("SyncTables", tableSchema);

async function ready2orderRequest(endpoint) {
	const response = await fetch(`${API_BASE}${endpoint}`, {
		headers: {
			Authorization: `Bearer ${ACCOUNT_TOKEN}`,
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		const body = await response.text();

		throw new Error(
			`ready2order API error ${response.status}: ${body}`,
		);
	}

	return response.json();
}

function parseReadyDate(value) {
	if (!value) return null;

	const normalized = String(value).replace(" ", "T");
	const date = new Date(normalized);

	return Number.isNaN(date.getTime()) ? null : date;
}

function createQrToken() {
	return crypto.randomBytes(16).toString("hex");
}

function createQrUrl(qrToken) {
	return `${PUBLIC_APP_URL}/${RESTAURANT_ID}?table=${qrToken}`;
}

async function fetchAllTables() {
	const limit = 250;
	let page = 1;
	const tables = [];

	while (true) {
		const query = new URLSearchParams({
			limit: String(limit),
			page: String(page),
		});

		console.log(`Lade Tischseite ${page} ...`);

		const result = await ready2orderRequest(
			`/tables?${query.toString()}`,
		);

		if (!Array.isArray(result)) {
			throw new Error(
				`Unexpected tables response: ${JSON.stringify(result).slice(0, 500)}`,
			);
		}

		console.log(
			`Seite ${page}: ${result.length} Tische`,
		);

		tables.push(...result);

		if (result.length < limit) {
			break;
		}

		page += 1;
	}

	return tables;
}

async function syncTables() {
	await mongoose.connect(MONGODB_URI);

	console.log("MongoDB:", mongoose.connection.name);
	console.log("Restaurant:", RESTAURANT_ID);
	console.log("Public URL:", PUBLIC_APP_URL);

	const tables = await fetchAllTables();

	console.log(
		`Tische von ready2order erhalten: ${tables.length}`,
	);

	/*
	 * Bereits vorhandene Tische laden.
	 *
	 * Dadurch können wir qrToken und qrUrl bei bestehenden
	 * Tischen wiederverwenden.
	 */
	const existingTables = await Tables.find({
		restaurantID: RESTAURANT_ID,
	}).lean();

	const existingByReadyId = new Map(
		existingTables.map((table) => [
			table.ready2orderTableId,
			table,
		]),
	);

	const receivedTableIds = [];

	const operations = tables.map((table) => {
		if (table.table_id == null) {
			throw new Error(
				`Table without table_id: ${JSON.stringify(table)}`,
			);
		}

		receivedTableIds.push(table.table_id);

		/*
		 * Prüfen, ob dieser ready2order-Tisch bereits
		 * in unserer Datenbank existiert.
		 */
		const existingTable =
			existingByReadyId.get(table.table_id);

		/*
		 * Bestehender Tisch:
		 * vorhandenen QR-Token behalten.
		 *
		 * Neuer Tisch:
		 * genau einmal einen neuen Token erzeugen.
		 */
		const qrToken =
			existingTable?.qrToken ||
			createQrToken();

		const qrUrl =
			existingTable?.qrUrl ||
			createQrUrl(qrToken);

		return {
			updateOne: {
				filter: {
					restaurantID: RESTAURANT_ID,
					ready2orderTableId: table.table_id,
				},

				update: {
					$set: {
						restaurantID: RESTAURANT_ID,

						ready2orderTableId:
							table.table_id,

						ready2orderTableAreaId:
							table.tableArea_id ?? null,

						name:
							String(table.table_name),

						username:
							String(table.table_id),

						description:
							table.table_description || "",

						ready2orderOrder:
							table.table_order ?? 0,

						ready2orderCheckoutMode:
							table.table_checkoutMode === true,

						ready2orderIsTemporary:
							table.table_isTemporay === true,

						ready2orderUpdatedAt:
							parseReadyDate(
								table.table_updated_at,
							),

						/*
						 * Bleibt für diesen Tisch dauerhaft gleich.
						 */
						qrToken,

						/*
						 * Aktuell z. B.:
						 *
						 * http://localhost:3050/qrorder?table=TOKEN
						 */
						qrUrl,
					},
				},

				upsert: true,
			},
		};
	});

	if (operations.length > 0) {
		const result = await Tables.bulkWrite(
			operations,
			{
				ordered: false,
			},
		);

		console.log(
			"Neu angelegt:",
			result.upsertedCount,
		);

		console.log(
			"Aktualisiert:",
			result.modifiedCount,
		);

		console.log(
			"Gefunden:",
			result.matchedCount,
		);
	}

	/*
	 * Tische löschen, die ready2order nicht mehr liefert.
	 */
	const deleteResult =
		await Tables.deleteMany({
			restaurantID: RESTAURANT_ID,

			ready2orderTableId: {
				$nin: receivedTableIds,
			},
		});

	console.log(
		"Nicht mehr vorhandene Tische gelöscht:",
		deleteResult.deletedCount,
	);

	/*
	 * Alle Tisch-Dokumente erneut laden.
	 */
	const tableDocuments =
		await Tables.find({
			restaurantID: RESTAURANT_ID,
		}).lean();

	const tableIds =
		tableDocuments.map(
			(table) => table._id,
		);

	/*
	 * Mit dem bestehenden Restaurant-Account verknüpfen.
	 *
	 * bulkWrite löst die Mongoose post-save Hooks nicht aus,
	 * deshalb machen wir die Verknüpfung hier selbst.
	 */
	const accountResult =
		await mongoose.connection
			.collection("accounts")
			.updateOne(
				{
					username: RESTAURANT_ID,
				},
				{
					$set: {
						tables: tableIds,
					},
				},
			);

	console.log(
		"Account gefunden:",
		accountResult.matchedCount,
	);

	console.log(
		`Account mit ${tableIds.length} Tischen verknüpft`,
	);

	console.log(
		"Aktueller Tisch-Bestand:",
		tableDocuments.length,
	);

	/*
	 * QR-URLs zur Kontrolle ausgeben.
	 */
	console.log("\nQR-Codes:");

	for (const table of tableDocuments) {
		console.log(
			`${table.name}: ${table.qrUrl}`,
		);
	}
}

syncTables()
	.then(async () => {
		console.log(
			"\nTischsynchronisation abgeschlossen.",
		);

		await mongoose.disconnect();
	})
	.catch(async (error) => {
		console.error(
			"Tischsynchronisation fehlgeschlagen:",
		);

		console.error(error);

		await mongoose
			.disconnect()
			.catch(() => undefined);

		process.exit(1);
	});