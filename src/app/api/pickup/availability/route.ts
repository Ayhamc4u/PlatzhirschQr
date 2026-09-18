import { NextResponse } from "next/server";

import connectDB from "#utils/database/connect";
import { Orders } from "#utils/database/models/order";
import { Tables } from "#utils/database/models/table";
import { CatchNextResponse } from "#utils/helper/common";

const RESTAURANT_ID = process.env.RESTAURANT_ID || "platzhirsch";
const BASE_PICKUP_MINUTES = 20;
const QUEUE_STEP_MINUTES = 5;
const ORDERS_PER_QUEUE_STEP = 2;
const FOOD_LOAD_STEP_MINUTES = 5;
const FOOD_ORDERS_PER_STEP = 3;
const AUTO_ACCEPT_MAX_MINUTES = 30;
const ACTIVE_ORDER_MAX_AGE_MINUTES = 60;
const MAX_PICKUP_TABLE_NUMBER = 10;
const MAX_AUTO_PICKUP_TABLE_NUMBER = 5;

type TimestampedOrder = {
	_id: unknown;
	table: string;
	createdAt?: Date;
	updatedAt?: Date;
};

const getPickupTableNumber = (name?: string) => {
	const match = name?.trim().match(/^abh\s*(\d+)$/i);
	if (!match) return null;
	const number = Number(match[1]);
	return Number.isInteger(number) && number >= 1 && number <= MAX_PICKUP_TABLE_NUMBER ? number : null;
};

export async function GET() {
	try {
		await connectDB();

		const pickupTablesRaw = await Tables.find({
			restaurantID: RESTAURANT_ID,
			name: { $regex: /^abh\s*(?:10|[1-9])$/i },
		}).lean();
		const pickupTables = pickupTablesRaw
			.map((table) => ({ ...table, pickupNumber: getPickupTableNumber(table.name) }))
			.filter((table) => table.pickupNumber !== null)
			.sort((a, b) => (a.pickupNumber ?? 99) - (b.pickupNumber ?? 99));

		const pickupUsernames = pickupTables.map((table) => table.username);
		const now = Date.now();
		const activeCutoff = now - ACTIVE_ORDER_MAX_AGE_MINUTES * 60_000;

		const staleCleanup = pickupUsernames.length
			? await Orders.updateMany(
				{
					restaurantID: RESTAURANT_ID,
					state: "active",
					table: { $in: pickupUsernames },
					updatedAt: { $lt: new Date(activeCutoff) },
				},
				{ $set: { state: "complete" } },
			)
			: { modifiedCount: 0 };

		const activeOrders = await Orders.find({
			restaurantID: RESTAURANT_ID,
			state: "active",
		})
			.populate("products.product")
			.sort({ createdAt: 1 })
			.lean();

		const getLastActivity = (order: TimestampedOrder) => order.updatedAt ?? order.createdAt;
		const isCurrentOrder = (order: TimestampedOrder) => {
			const lastActivity = getLastActivity(order);
			return !!lastActivity && new Date(lastActivity).getTime() >= activeCutoff;
		};

		const activePickupOrders = activeOrders.filter(
			(order) => pickupUsernames.includes(order.table) && isCurrentOrder(order as TimestampedOrder),
		);
		const activeFoodOrders = activeOrders.filter((order) =>
			isCurrentOrder(order as TimestampedOrder) && order.products?.some((item: { product?: { ready2orderProductType?: string } }) => item.product?.ready2orderProductType === "food"),
		);

		const activePickupCount = activePickupOrders.length;
		const kitchenFoodCount = activeFoodOrders.length;
		const pickupPenalty = Math.ceil(activePickupCount / ORDERS_PER_QUEUE_STEP) * QUEUE_STEP_MINUTES;
		const kitchenPenalty = Math.ceil(kitchenFoodCount / FOOD_ORDERS_PER_STEP) * FOOD_LOAD_STEP_MINUTES;
		const estimatedMinutes = Math.min(60, BASE_PICKUP_MINUTES + pickupPenalty + kitchenPenalty);
		const readyAt = new Date(now + estimatedMinutes * 60_000);

		const occupiedTables = new Set(activePickupOrders.map((order) => order.table));
		const freeAutoTable = pickupTables.find(
			(table) => (table.pickupNumber ?? 99) <= MAX_AUTO_PICKUP_TABLE_NUMBER && !occupiedTables.has(table.username),
		) ?? null;
		const freeReserveTable = pickupTables.find(
			(table) => (table.pickupNumber ?? 0) > MAX_AUTO_PICKUP_TABLE_NUMBER && !occupiedTables.has(table.username),
		) ?? null;
		const selectedPickupTable = freeAutoTable ?? freeReserveTable;
		const capacityAvailable = !!selectedPickupTable;
		const autoAccept = !!freeAutoTable && estimatedMinutes <= AUTO_ACCEPT_MAX_MINUTES;

		const formatDebugOrder = (rawOrder: unknown) => {
			const order = rawOrder as TimestampedOrder;
			const lastActivity = getLastActivity(order);
			return {
				id: String(order._id),
				table: order.table,
				createdAt: order.createdAt,
				updatedAt: order.updatedAt,
				ageMinutes: lastActivity ? Math.max(0, Math.round((now - new Date(lastActivity).getTime()) / 60_000)) : null,
			};
		};

		return NextResponse.json({
			restaurantID: RESTAURANT_ID,
			available: capacityAvailable,
			estimatedMinutes,
			readyAt: readyAt.toISOString(),
			queueAhead: activePickupCount,
			activeFoodOrders: kitchenFoodCount,
			maxActivePickups: MAX_PICKUP_TABLE_NUMBER,
			autoAccept,
			requiresConfirmation: capacityAvailable && !autoAccept,
			updatedAt: new Date(now).toISOString(),
			activeOrderMaxAgeMinutes: ACTIVE_ORDER_MAX_AGE_MINUTES,
			stalePickupOrdersCompleted: staleCleanup.modifiedCount,
			pickupTable: selectedPickupTable
				? {
					username: selectedPickupTable.username,
					name: selectedPickupTable.name,
					pickupNumber: selectedPickupTable.pickupNumber,
					autoBookable: (selectedPickupTable.pickupNumber ?? 99) <= MAX_AUTO_PICKUP_TABLE_NUMBER,
				}
				: null,
			debug: process.env.NODE_ENV !== "production"
				? {
					activePickupOrders: activePickupOrders.map(formatDebugOrder),
					freeAutoTable: freeAutoTable?.name ?? null,
					freeReserveTable: freeReserveTable?.name ?? null,
					stalePickupOrdersCompleted: staleCleanup.modifiedCount,
				}
				: undefined,
		});
	} catch (err) {
		return CatchNextResponse(err);
	}
}

export const dynamic = "force-dynamic";
