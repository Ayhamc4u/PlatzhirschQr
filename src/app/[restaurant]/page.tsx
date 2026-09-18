import type { Metadata } from "next";
import { capitalize } from "xtreme-ui";

import { CustomerProvider } from "#components/context";
import JsonLd from "#components/seo/JsonLd";
import { getRestaurantProfile } from "#utils/database/helper/getRestaurantProfile";
import { SITE_URL } from "#utils/seo/constants";
import { buildMetadata } from "#utils/seo/metadata";

import PageContainer from "./_components/PageContainer";
import "./restaurant.scss";

export async function generateMetadata({ params }: IRestaurantProps): Promise<Metadata> {
	const { restaurant } = await params;
	const profile = await getRestaurantProfile(restaurant);
	const name = profile?.name ?? capitalize(restaurant);
	const description = profile?.description ?? `Speisen und Getränke bei ${name} ansehen und direkt bestellen.`;

	return buildMetadata({
		title: `${name} — Menü & Bestellung`,
		description,
		path: `/${restaurant}`,
	});
}

const Restaurant = async ({ params }: IRestaurantProps) => {
	const { restaurant } = await params;
	const profile = await getRestaurantProfile(restaurant);
	const name = profile?.name ?? capitalize(restaurant);

	return (
		<CustomerProvider>
			<JsonLd
				data={{
					"@context": "https://schema.org",
					"@type": "Restaurant",
					name,
					url: `${SITE_URL}/${restaurant}`,
					...(profile?.description && { description: profile.description }),
					...(profile?.address && { address: { "@type": "PostalAddress", streetAddress: profile.address } }),
					...(profile?.cover && { image: profile.cover }),
					...(profile?.categories?.length && { servesCuisine: profile.categories }),
					hasMenu: { "@type": "Menu", url: `${SITE_URL}/${restaurant}` },
					potentialAction: {
						"@type": "OrderAction",
						target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/${restaurant}` },
					},
				}}
			/>
			<div className="restaurant">
				<PageContainer />
			</div>
		</CustomerProvider>
	);
};

export default Restaurant;

interface IRestaurantProps {
	params: Promise<{ restaurant: string }>;
	searchParams: Promise<{ [key: string]: string | undefined }>;
}
