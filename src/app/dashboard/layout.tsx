import type { ReactNode } from "react";
import Script from "next/script";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { themeController } from "xtreme-ui";

import { getThemeColor } from "#utils/database/helper/getThemeColor";
import { authOptions } from "#utils/helper/authHelper";

const ADMIN_ACCESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const metadata = {
	title: "Platzhirsch • Admin",
};

export default async function RootLayout({ children }: IRootProps) {
	const session = await getServerSession(authOptions);
	if (!session || session.role !== "admin") redirect("/admin/login");

	const issuedAt = Number((session as typeof session & { authIssuedAt?: number }).authIssuedAt ?? 0);
	if (!issuedAt || Date.now() - issuedAt > ADMIN_ACCESS_MAX_AGE_MS) redirect("/logout");

	const themeColor = await getThemeColor();
	return (
		<>
			<Script id="dashboard-theme" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: themeController({ color: themeColor }) }} />
			{children}
		</>
	);
}

interface IRootProps {
	children?: ReactNode;
}
