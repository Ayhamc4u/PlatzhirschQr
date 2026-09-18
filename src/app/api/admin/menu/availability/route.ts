import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Menus, OrderTypes, type TOrderType } from "#utils/database/models/menu";
import { authOptions } from "#utils/helper/authHelper";
import { CatchNextResponse } from "#utils/helper/common";

const isValidOrderType = (value: unknown): value is TOrderType =>
	typeof value === "string" && (OrderTypes as readonly string[]).includes(value);

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session) throw { status: 401, message: "Authentication Required" };
		if (session.role !== "admin") throw { status: 403, message: "Admin access required" };
		if (!session.username) throw { status: 403, message: "Restaurant context missing" };

		const { itemId, category, hidden, availableOrderTypes } = await req.json();
		if (!itemId && !category) throw { status: 400, message: "Menu item id or category is required" };
		if (itemId && category) throw { status: 400, message: "Update either one menu item or one category" };
		if (typeof hidden !== "boolean") throw { status: 400, message: "Hidden value must be a boolean" };
		if (!Array.isArray(availableOrderTypes)) throw { status: 400, message: "availableOrderTypes must be an array" };
		if (!availableOrderTypes.every(isValidOrderType)) throw { status: 400, message: "Invalid order type" };

		const normalizedOrderTypes = [...new Set<TOrderType>(availableOrderTypes)];
		if (!hidden && normalizedOrderTypes.length === 0) {
			throw { status: 400, message: "At least one order type is required for an active menu item" };
		}

		await connectDB();
		const filter = {
			restaurantID: session.username,
			...(itemId ? { _id: itemId } : { category }),
		};
		const update = {
			hidden,
			availableOrderTypes: hidden ? [] : normalizedOrderTypes,
		};

		if (itemId) {
			const result = await Menus.updateOne(filter, { $set: update });
			if (result.matchedCount === 0) throw { status: 404, message: "Menu item not found" };
		} else {
			const result = await Menus.updateMany(filter, { $set: update });
			if (result.matchedCount === 0) throw { status: 404, message: "Menu category not found" };
		}

		return NextResponse.json({
			status: 200,
			itemId: itemId ?? null,
			category: category ?? null,
			hidden,
			availableOrderTypes: update.availableOrderTypes,
		});
	} catch (err) {
		return CatchNextResponse(err);
	}
}

export const dynamic = "force-dynamic";
