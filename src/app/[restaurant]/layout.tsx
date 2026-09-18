import Script from "next/script";
import type { ReactNode } from "react";
import { themeController } from "xtreme-ui";

import { getThemeColor } from "#utils/database/helper/getThemeColor";

export default async function RootLayout({ children, params }: IRootProps) {
	const { restaurant } = await params;
	const themeColor = await getThemeColor(restaurant);

	return (
		<>
			<Script
				id={`restaurant-theme-${restaurant}`}
				strategy="afterInteractive"
				dangerouslySetInnerHTML={{ __html: themeController({ color: themeColor }) }}
			/>
			{children}
		</>
	);
}

interface IRootProps {
	children?: ReactNode;
	params: Promise<{
		restaurant: string;
	}>;
}
