import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Menus } from "#utils/database/models/menu";
import { Profiles } from "#utils/database/models/profile";
import { authOptions } from "#utils/helper/authHelper";
import { validateWeeklySchedule } from "#utils/helper/businessHours";
import { CatchNextResponse } from "#utils/helper/common";

const CATEGORY_PATTERN = /^[a-z0-9-]+$/;

export async function POST(request: Request) {
	try {
		await connectDB();
		const session = await getServerSession(authOptions);
		if (!session || session.role !== "admin" || !session.username) throw { status: 401, message: "Authentication Required" };

		const body = await request.json();
		const category = typeof body?.category === "string" ? body.category.trim().toLowerCase() : "";
		const schedule = body?.schedule;
		if (!CATEGORY_PATTERN.test(category)) throw { status: 400, message: "Ungültige Kategorie" };
		if (schedule !== null && !validateWeeklySchedule(schedule)) throw { status: 400, message: "Ungültige Kategoriezeiten" };

		const menuExists = await Menus.exists({ restaurantID: session.username, category });
		if (!menuExists) throw { status: 404, message: "Kategorie nicht gefunden" };

		const update = schedule === null
			? { $unset: { [`categoryAvailability.${category}`]: 1 } }
			: { $set: { [`categoryAvailability.${category}`]: schedule } };
		const profile = await Profiles.findOneAndUpdate({ restaurantID: session.username }, update, { new: true }).lean();
		if (!profile) throw { status: 404, message: "Restaurantprofil nicht gefunden" };

		return NextResponse.json({ category, schedule: schedule ?? null });
	} catch (err) {
		return CatchNextResponse(err);
	}
}
