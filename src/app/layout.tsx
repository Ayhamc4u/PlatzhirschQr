import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Gliff } from "xtreme-ui";

import { GlobalProvider } from "#components/context";
import { antonio, didactGothic } from "#utils/helper/fontHelper";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL } from "#utils/seo/constants";
import "./globals.scss";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		template: `%s | ${SITE_NAME}`,
		default: `${SITE_NAME} — Online bestellen`,
	},
	description: SITE_DESCRIPTION,
	keywords: [...SITE_KEYWORDS],
	openGraph: {
		type: "website",
		locale: "de_AT",
		siteName: SITE_NAME,
	},
	twitter: { card: "summary_large_image" },
	robots: {
		index: true,
		follow: true,
		"max-image-preview": "large",
		"max-snippet": -1,
		"max-video-preview": -1,
	},
};

const themeBootstrap = `(() => {
	try {
		const stored = localStorage.getItem("platzhirsch-theme");
		const theme = stored === "light" || stored === "dark" ? stored : "dark";
		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
	} catch {
		document.documentElement.dataset.theme = "dark";
		document.documentElement.style.colorScheme = "dark";
	}
})();`;

export default function RootLayout({ children }: IRootProps) {
	return (
		<html lang="de" className={`${antonio.variable} ${didactGothic.variable}`} suppressHydrationWarning data-scroll-behavior="smooth" data-theme="dark">
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
				<Gliff next />
			</head>
			<body>
				<GlobalProvider>{children}</GlobalProvider>
			</body>
		</html>
	);
}

interface IRootProps {
	children?: ReactNode;
}
