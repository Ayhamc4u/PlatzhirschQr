import { Antonio, Didact_Gothic } from "next/font/google";

export const antonio = Antonio({
	subsets: ["latin"],
	variable: "--font-antonio",
	display: "swap",
	preload: false,
});

export const didactGothic = Didact_Gothic({
	weight: "400",
	subsets: ["latin"],
	variable: "--font-didact-gothic",
	display: "swap",
	preload: false,
});
