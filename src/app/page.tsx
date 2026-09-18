import type { Metadata } from "next";

import PageContainer from "./_homepage/PageContainer";

export const metadata: Metadata = {
	title: "Platzhirsch — Online bestellen",
	description: "Beim Platzhirsch online zur Abholung bestellen oder vor Ort per QR-Code bestellen.",
};

export default function Homepage() {
	return (
		<div className="homepage">
			<PageContainer />
		</div>
	);
}
