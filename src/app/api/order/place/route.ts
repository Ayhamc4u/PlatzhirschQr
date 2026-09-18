import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Customers } from "#utils/database/models/customer";
import { Menus, type TMenu, type TOrderType } from "#utils/database/models/menu";
import { Orders, type TOrder, type TProduct } from "#utils/database/models/order";
import { Profiles } from "#utils/database/models/profile";
import { Tables } from "#utils/database/models/table";
import { authOptions } from "#utils/helper/authHelper";
import { CatchNextResponse } from "#utils/helper/common";
import { requireDineInVenueAccess } from "#utils/helper/dineInAccess";
import { isCartScheduleOpenAt, isPickupTimeAvailable } from "#utils/helper/pickupSlots";

const BASE_PICKUP_MINUTES = 20;
const QUEUE_STEP_MINUTES = 5;
const ORDERS_PER_QUEUE_STEP = 2;
const FOOD_LOAD_STEP_MINUTES = 5;
const FOOD_ORDERS_PER_STEP = 3;
const AUTO_ACCEPT_MAX_MINUTES = 30;
const ACTIVE_ORDER_MAX_AGE_MINUTES = 60;
const MAX_PICKUP_TABLE_NUMBER = 10;
const MAX_AUTO_PICKUP_TABLE_NUMBER = 5;
const READY2ORDER_API_BASE = process.env.READY2ORDER_API_BASE || "https://api.ready2order.com/v1";
const READY2ORDER_TRAINING_MODE = process.env.READY2ORDER_TRAINING_MODE !== "false";
const READY2ORDER_CONTACT_PRODUCT_ID = Number.parseInt(process.env.READY2ORDER_CONTACT_PRODUCT_ID || "", 10);
const LEGACY_PICKUP_CATEGORIES = new Set(["burger", "pizza", "snacks", "salate", "nachspeisen", "oel", "most", "wein"]);

type Ready2OrderItem = {
	product_id: number;
	item_quantity: string;
	item_price: string;
	item_vatRate: string;
	item_comment?: string;
	item_variations?: Array<{
		product_id: number;
		variation_name: string;
		variation_price: number;
	}>;
};
type Ready2OrderOrder = { order_id?: number };
type TimestampedOrder = { _id: unknown; table: string; createdAt?: Date; updatedAt?: Date; requestedPickupAt?: Date };

const getPickupTableNumber = (name?: string) => {
	const match = name?.trim().match(/^abh\s*(\d+)$/i);
	if (!match) return null;
	const number = Number(match[1]);
	return Number.isInteger(number) && number >= 1 && number <= MAX_PICKUP_TABLE_NUMBER ? number : null;
};

const isCurrentOrder = (order: TimestampedOrder, cutoff: number) => {
	const lastActivity = order.updatedAt ?? order.createdAt;
	return !!lastActivity && new Date(lastActivity).getTime() >= cutoff;
};

const isOperationalNow = (order: TimestampedOrder, now: number, cutoff: number) => {
	if (!order.requestedPickupAt) return isCurrentOrder(order, cutoff);
	const pickupAt = new Date(order.requestedPickupAt).getTime();
	const windowMs = ACTIVE_ORDER_MAX_AGE_MINUTES * 60_000;
	return pickupAt >= now - windowMs && pickupAt <= now + windowMs;
};

const isMenuItemAvailableFor = (menuItem: TMenu, orderType: TOrderType) => {
	if (Array.isArray(menuItem.availableOrderTypes)) return menuItem.availableOrderTypes.includes(orderType);
	if (orderType === "DINE_IN") return true;
	if (orderType === "PICKUP") return LEGACY_PICKUP_CATEGORIES.has(menuItem.category);
	return false;
};

async function submitToReady2Order(tableId: number, items: Ready2OrderItem[], requestId: string, trainingMode: boolean) {
	const token = process.env.READY2ORDER_ACCOUNT_TOKEN;
	if (!token) throw { status: 500, message: "READY2ORDER_ACCOUNT_TOKEN fehlt." };

	const url = `${READY2ORDER_API_BASE.replace(/\/$/, "")}/orders`;
	const payload = { table_id: tableId, price_base: "gross", training_mode: trainingMode, items };
	console.info("[order/place] ready2order request", { requestId, url, tableId, itemCount: items.length, trainingMode, payload, tokenConfigured: true });

	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify(payload),
			cache: "no-store",
		});
	} catch (error) {
		console.error("[order/place] ready2order network error", { requestId, url, trainingMode, error });
		throw { status: 502, message: `ready2order konnte nicht erreicht werden. Referenz: ${requestId}` };
	}

	const raw = await response.text();
	let data: unknown = raw;
	try { data = raw ? JSON.parse(raw) : null; } catch {}
	console.info("[order/place] ready2order response", { requestId, status: response.status, statusText: response.statusText, contentType: response.headers.get("content-type"), trainingMode, data });

	if (!response.ok) {
		console.error("[order/place] ready2order order submission failed", { requestId, status: response.status, statusText: response.statusText, trainingMode, data, payload });
		throw { status: 502, message: `ready2order hat die Bestellung abgelehnt (${response.status}). Referenz: ${requestId}` };
	}
	if (!Array.isArray(data)) {
		console.error("[order/place] unexpected ready2order order response", { requestId, trainingMode, data });
		throw { status: 502, message: `Unerwartete Antwort von ready2order. Referenz: ${requestId}` };
	}
	return data as Ready2OrderOrder[];
}

export async function POST(req: Request) {
	const requestId = crypto.randomUUID().slice(0, 8);
	try {
		const session = await getServerSession(authOptions);
		const body = await req.json();

		if (!session) throw { status: 401, message: "Authentication Required" };
		if (!body?.products?.length) throw { status: 400, message: "Can't place order on empty cart" };

		const restaurantID = session?.restaurant?.username;
		const customer = session?.customer?._id;
		const requestedOrderType: TOrderType = body?.orderType === "PICKUP" ? "PICKUP" : "DINE_IN";
		const requestedTable = typeof body?.table === "string" && body.table.trim() ? body.table.trim() : session?.restaurant?.table;

		console.info("[order/place] request started", {
			requestId,
			hasSession: !!session,
			restaurantID,
			requestedTable,
			requestedOrderType,
			customer,
			productCount: Array.isArray(body?.products) ? body.products.length : 0,
			ready2orderTrainingMode: READY2ORDER_TRAINING_MODE,
		});

		if (!restaurantID) throw { status: 400, message: "Restaurant wurde nicht gefunden." };
		await connectDB();

		const profile = await Profiles.findOne({ restaurantID }).lean();
		if (!profile) throw { status: 404, message: "Restaurantprofil wurde nicht gefunden." };

		const isPickup = requestedOrderType === "PICKUP";
		const orderType: TOrderType = isPickup ? "PICKUP" : "DINE_IN";
		if (profile.orderPause?.all) throw { status: 409, message: "Bestellungen sind derzeit pausiert." };
		if (isPickup && profile.orderPause?.pickup) throw { status: 409, message: "Abholbestellungen sind derzeit pausiert." };
		if (!isPickup && profile.orderPause?.dineIn) throw { status: 409, message: "Tischbestellungen sind derzeit pausiert." };

		const now = Date.now();
		const nowDate = new Date(now);
		let requestedPickupAt: Date | undefined;
		if (isPickup) {
			requestedPickupAt = new Date(String(body?.requestedPickupAt ?? ""));
			if (!Number.isFinite(requestedPickupAt.getTime())) throw { status: 400, message: "Bitte wähle eine gültige Abholzeit." };
			if (!isPickupTimeAvailable(profile, [], requestedPickupAt, nowDate)) {
				throw { status: 409, message: "Die gewählte Abholzeit ist nicht mehr verfügbar. Bitte wähle eine neue Zeit." };
			}
		} else if (!isCartScheduleOpenAt(profile, [], nowDate)) {
			throw { status: 409, message: "Tischbestellungen sind außerhalb der Servicezeiten nicht möglich." };
		}

		const pickupTablesRaw = await Tables.find({ restaurantID, name: { $regex: /^abh\s*(?:10|[1-9])$/i } }).lean();
		const pickupTables = pickupTablesRaw
			.map((table) => ({ ...table, pickupNumber: getPickupTableNumber(table.name) }))
			.filter((table) => table.pickupNumber !== null)
			.sort((a, b) => (a.pickupNumber ?? 99) - (b.pickupNumber ?? 99));
		const pickupUsernames = pickupTables.map((pickupTable) => pickupTable.username);

		let requestedTableRecord = null;
		if (!isPickup) {
			requestedTableRecord = await Tables.findOne({ restaurantID, username: requestedTable }).lean();
			if (!requestedTableRecord) throw { status: 400, message: "Tisch wurde nicht gefunden." };
			requireDineInVenueAccess(req);
		}

		if (isPickup && pickupTables.length === 0) {
			throw { status: 409, message: "Für die Abholung sind derzeit keine technischen Abholplätze konfiguriert." };
		}

		const activeCutoff = now - ACTIVE_ORDER_MAX_AGE_MINUTES * 60_000;

		if (isPickup && pickupUsernames.length) {
			await Orders.updateMany(
				{
					restaurantID,
					state: "active",
					table: { $in: pickupUsernames },
					$or: [
						{ requestedPickupAt: { $exists: false }, updatedAt: { $lt: new Date(activeCutoff) } },
						{ requestedPickupAt: { $lt: new Date(activeCutoff) } },
					],
				},
				{ $set: { state: "complete" } },
			);
		}

		let existingOrder = await Orders.findOne<TOrder>({ restaurantID, customer, state: "active" });
		if (existingOrder) {
			const existingIsPickup = existingOrder.orderType === "PICKUP" || pickupUsernames.includes(existingOrder.table);
			const sameTrainingMode = existingOrder.ready2orderTrainingMode === READY2ORDER_TRAINING_MODE;
			if (existingIsPickup !== isPickup || !sameTrainingMode) existingOrder = null;
			else existingOrder.orderType = orderType;
		}

		let effectiveTableRecord = requestedTableRecord;
		let estimatedMinutes: number | undefined;
		let estimatedReadyAt: Date | undefined;
		let autoAccept = false;

		if (isPickup) {
			const activeOrders = await Orders.find({ restaurantID, state: "active" }).populate("products.product").lean();
			const currentOrders = activeOrders.filter((order) => isOperationalNow(order as TimestampedOrder, now, activeCutoff));
			const activePickupOrders = currentOrders.filter((order) => order.orderType === "PICKUP" || pickupUsernames.includes(order.table));
			const activeFoodOrders = currentOrders.filter((order) => order.products?.some((item: { product?: { ready2orderProductType?: string } }) => item.product?.ready2orderProductType === "food"));
			const existingPickupTable = existingOrder && pickupUsernames.includes(existingOrder.table) ? pickupTables.find((table) => table.username === existingOrder?.table) ?? null : null;
			const occupiedTables = new Set(activePickupOrders.map((order) => order.table));
			const freeAutoTable = pickupTables.find((table) => (table.pickupNumber ?? 99) <= MAX_AUTO_PICKUP_TABLE_NUMBER && !occupiedTables.has(table.username)) ?? null;
			const freeReserveTable = pickupTables.find((table) => (table.pickupNumber ?? 0) > MAX_AUTO_PICKUP_TABLE_NUMBER && !occupiedTables.has(table.username)) ?? null;
			const selectedPickupTable = existingPickupTable ?? freeAutoTable ?? freeReserveTable;
			if (!selectedPickupTable) throw { status: 409, message: "Derzeit sind alle Abholplätze Abh1 bis Abh10 belegt." };

			effectiveTableRecord = selectedPickupTable;
			const pickupPenalty = Math.ceil(activePickupOrders.length / ORDERS_PER_QUEUE_STEP) * QUEUE_STEP_MINUTES;
			const kitchenPenalty = Math.ceil(activeFoodOrders.length / FOOD_ORDERS_PER_STEP) * FOOD_LOAD_STEP_MINUTES;
			const immediateEstimate = Math.min(60, BASE_PICKUP_MINUTES + pickupPenalty + kitchenPenalty);
			estimatedReadyAt = requestedPickupAt;
			estimatedMinutes = requestedPickupAt ? Math.max(0, Math.ceil((requestedPickupAt.getTime() - now) / 60_000)) : immediateEstimate;
			autoAccept = (selectedPickupTable.pickupNumber ?? 99) <= MAX_AUTO_PICKUP_TABLE_NUMBER && estimatedMinutes <= AUTO_ACCEPT_MAX_MINUTES;
			if (existingOrder && !existingPickupTable) existingOrder = null;
		}

		if (!effectiveTableRecord) throw { status: 400, message: "Bestellkontext konnte nicht aufgelöst werden." };
		console.info("[order/place] table resolved", { requestId, orderType, requestedTable, effectiveTable: effectiveTableRecord.name, effectiveTableUsername: effectiveTableRecord.username, ready2orderTableId: effectiveTableRecord.ready2orderTableId, autoAccept, estimatedMinutes, requestedPickupAt, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE });
		if (!effectiveTableRecord.ready2orderTableId) throw { status: 409, message: "Für diesen Tisch fehlt die ready2order-Zuordnung." };

		const ready2orderItems: Ready2OrderItem[] = [];
		const products: TProduct[] = await Promise.all(
			body.products.map(async (product: TProduct & { _id: string }) => {
				const menuItem = await Menus.findById<TMenu>(product._id).lean();
				if (!menuItem || menuItem.restaurantID !== restaurantID) throw { status: 404, message: "Ordered product(s) not found." };
				if (menuItem.hidden) throw { status: 409, message: `'${menuItem.name}' ist derzeit nicht verfügbar.` };
				if (!isMenuItemAvailableFor(menuItem, orderType)) {
					throw { status: 409, message: `'${menuItem.name}' ist für ${orderType === "PICKUP" ? "Abholung" : "Tischservice"} nicht freigeschaltet.` };
				}
				if (isPickup && requestedPickupAt && !isPickupTimeAvailable(profile, [menuItem.category], requestedPickupAt, nowDate)) {
					throw { status: 409, message: `'${menuItem.name}' ist zur gewählten Abholzeit nicht verfügbar.` };
				}
				if (!isPickup && !isCartScheduleOpenAt(profile, [menuItem.category], nowDate)) {
					throw { status: 409, message: `'${menuItem.name}' ist zu dieser Zeit nicht verfügbar.` };
				}
				if (!menuItem.ready2orderProductId) throw { status: 409, message: `Für '${menuItem.name}' fehlt die ready2order-Produktzuordnung.` };
				if (!Number.isInteger(product.quantity) || product.quantity <= 0) throw { status: 400, message: "Ungültige Bestellmenge." };
				if (!Number.isFinite(menuItem.price) || menuItem.price < 0) throw { status: 409, message: `Für '${menuItem.name}' fehlt ein gültiger Preis.` };
				if (!Number.isFinite(menuItem.taxPercent) || menuItem.taxPercent < 0) throw { status: 409, message: `Für '${menuItem.name}' fehlt ein gültiger Steuersatz.` };

				const comment = String(product.comment ?? "").trim().slice(0, 500);
				const requestedVariations = Array.isArray(product.selectedVariations) ? product.selectedVariations : [];
				const selectedVariations: NonNullable<TProduct["selectedVariations"]> = [];
				const seenVariationIds = new Set<number>();

				for (const requestedVariation of requestedVariations) {
					const productId = Number(requestedVariation?.productId);
					if (!Number.isInteger(productId) || seenVariationIds.has(productId)) continue;
					const allowedVariation = menuItem.ready2orderVariations?.find((variation: { productId: number; name: string; price: number }) => variation.productId === productId);
					if (!allowedVariation) throw { status: 400, message: `Ungültige Variante für '${menuItem.name}'.` };
					seenVariationIds.add(productId);
					selectedVariations.push({ productId: allowedVariation.productId, name: allowedVariation.name, price: allowedVariation.price });
				}

				const item: Ready2OrderItem = {
					product_id: menuItem.ready2orderProductId,
					item_quantity: String(product.quantity),
					item_price: menuItem.price.toFixed(2),
					item_vatRate: String(menuItem.taxPercent),
				};
				if (comment) item.item_comment = comment;
				if (selectedVariations.length) {
					item.item_variations = selectedVariations.map((variation: NonNullable<TProduct["selectedVariations"]>[number]) => ({
						product_id: variation.productId,
						variation_name: variation.name,
						variation_price: variation.price,
					}));
				}
				ready2orderItems.push(item);

				const extrasPrice = selectedVariations.reduce((sum, variation) => sum + variation.price, 0);
				const unitPrice = menuItem.price + extrasPrice;
				return {
					product: product._id,
					quantity: product.quantity,
					price: unitPrice,
					tax: Number(((unitPrice * menuItem.taxPercent) / 100).toFixed(2)),
					comment,
					selectedVariations,
					adminApproved: isPickup ? autoAccept : false,
				};
			}),
		);

		if (isPickup && Number.isInteger(READY2ORDER_CONTACT_PRODUCT_ID) && READY2ORDER_CONTACT_PRODUCT_ID > 0) {
			const contactCustomer = customer ? await Customers.findById(customer).lean() : null;
			const firstName = String(contactCustomer?.fname ?? session?.customer?.fname ?? "").trim();
			const lastName = String(contactCustomer?.lname ?? session?.customer?.lname ?? "").trim();
			const phone = String(contactCustomer?.phone ?? session?.customer?.phone ?? "").trim();
			const fullName = [firstName, lastName].filter(Boolean).join(" ");
			const readyTime = estimatedReadyAt
				? new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(estimatedReadyAt)
				: null;
			const contactLines = [
				`ABHOLUNG: ${effectiveTableRecord.name}`,
				readyTime ? `GEWÜNSCHT: ${readyTime} UHR` : null,
				fullName || "Name: nicht hinterlegt",
				phone ? `Tel: ${phone}` : "Tel: nicht hinterlegt",
				`Referenz: ${requestId}`,
			].filter((line): line is string => Boolean(line));

			ready2orderItems.push({
				product_id: READY2ORDER_CONTACT_PRODUCT_ID,
				item_quantity: "1",
				item_price: "0.00",
				item_vatRate: "20",
				item_comment: contactLines.join("\n").slice(0, 500),
			});
			console.info("[order/place] pickup contact slip added", { requestId, productId: READY2ORDER_CONTACT_PRODUCT_ID, pickupTable: effectiveTableRecord.name, requestedPickupAt, hasName: !!fullName, hasPhone: !!phone });
		}

		console.info("[order/place] products resolved", { requestId, orderType, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE, ready2orderItems });
		const ready2orderOrders = await submitToReady2Order(effectiveTableRecord.ready2orderTableId, ready2orderItems, requestId, READY2ORDER_TRAINING_MODE);
		const ready2orderOrderIds = ready2orderOrders.map((order) => order.order_id).filter((id): id is number => typeof id === "number");
		console.info("[order/place] ready2order accepted", { requestId, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE, ready2orderOrderIds });

		if (existingOrder) {
			existingOrder.orderType = orderType;
			existingOrder.ready2orderTrainingMode = READY2ORDER_TRAINING_MODE;
			existingOrder.products = [...existingOrder.products, ...products];
			existingOrder.ready2orderTableId = effectiveTableRecord.ready2orderTableId;
			existingOrder.ready2orderOrderIds = [...(existingOrder.ready2orderOrderIds ?? []), ...ready2orderOrderIds];
			existingOrder.ready2orderSubmittedAt = new Date();
			if (isPickup) {
				existingOrder.table = effectiveTableRecord.username;
				existingOrder.approvalMode = autoAccept ? "auto" : "manual";
				existingOrder.requestedPickupAt = requestedPickupAt;
				existingOrder.estimatedMinutes = estimatedMinutes;
				existingOrder.estimatedReadyAt = estimatedReadyAt;
			}
			await existingOrder.save();
			console.info("[order/place] local order updated", { requestId, orderId: existingOrder._id.toString(), orderType, requestedPickupAt, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE });
			return NextResponse.json({ status: 200, message: autoAccept ? "Bestellung automatisch angenommen" : "Bestellung an ready2order übermittelt", orderType, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE, autoAccept, estimatedMinutes, estimatedReadyAt, requestedPickupAt, pickupTable: isPickup ? effectiveTableRecord.name : undefined, ready2orderOrderIds, requestId });
		}

		const newOrder = new Orders({ restaurantID, orderType, table: effectiveTableRecord.username, customer, products, approvalMode: isPickup && autoAccept ? "auto" : "manual", requestedPickupAt, estimatedMinutes, estimatedReadyAt, ready2orderTableId: effectiveTableRecord.ready2orderTableId, ready2orderOrderIds, ready2orderSubmittedAt: new Date(), ready2orderTrainingMode: READY2ORDER_TRAINING_MODE });
		await newOrder.save();
		console.info("[order/place] local order created", { requestId, orderId: newOrder._id.toString(), orderType, requestedPickupAt, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE });
		return NextResponse.json({ status: 200, message: autoAccept ? "Bestellung automatisch angenommen" : "Bestellung an ready2order übermittelt", orderType, ready2orderTrainingMode: READY2ORDER_TRAINING_MODE, autoAccept, estimatedMinutes, estimatedReadyAt, requestedPickupAt, pickupTable: isPickup ? effectiveTableRecord.name : undefined, ready2orderOrderIds, requestId });
	} catch (err) {
		console.error("[order/place] failed", { requestId, error: err });
		return CatchNextResponse(err);
	}
}

export const dynamic = "force-dynamic";
