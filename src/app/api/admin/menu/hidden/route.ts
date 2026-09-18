import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Menus, type TMenu } from "#utils/database/models/menu";
import { authOptions } from "#utils/helper/authHelper";
import { CatchNextResponse } from "#utils/helper/common";

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session) throw { status: 401, message: "Authentication Required" };
		if (session.role !== "admin") throw { status: 403, message: "Admin access required" };
		if (!session.username) throw { status: 403, message: "Restaurant context missing" };

		const { itemId, hidden } = await req.json();
		if (!itemId) throw { status: 400, message: "Menu item id is required" };
		if (typeof hidden !== "boolean") throw { status: 400, message: "Hidden value must be a boolean" };

		await connectDB();
		const menuItem = await Menus.findOne<TMenu>({ _id: itemId, restaurantID: session.username });
		if (!menuItem) throw { status: 404, message: `Menu item with id: ${itemId}, not found` };

		menuItem.hidden = hidden;
		await menuItem.save();

		return NextResponse.json({ status: 200, message: hidden ? "Menu item is now hidden" : "Menu item is now visible to customers" });
	} catch (err) {
		return CatchNextResponse(err);
	}
}

export const dynamic = "force-dynamic";
