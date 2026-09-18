import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Customers } from "#utils/database/models/customer";
import { Orders } from "#utils/database/models/order";
import { formatEuro } from "#utils/helper/currency";
import { authOptions } from "#utils/helper/authHelper";

import AccountProfileForm from "./AccountProfileForm";
import "./account.scss";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, string> = {
	active: "In Bearbeitung",
	complete: "Abgeschlossen",
	cancel: "Storniert",
	reject: "Abgelehnt",
};

type AccountOrderItem = {
	product?: unknown;
	quantity: number;
};

export default async function AccountPage({ params }: { params: Promise<{ restaurant: string }> }) {
	const { restaurant } = await params;
	const session = await getServerSession(authOptions);
	const customerSession = session as typeof session & { role?: string; customer?: { _id?: string } };

	if (!customerSession || customerSession.role !== "customer" || !customerSession.customer?._id) redirect(`/${restaurant}/account/login`);

	await connectDB();
	const [customer, orders] = await Promise.all([
		Customers.findById(customerSession.customer._id).select("+passwordHash").lean(),
		Orders.find({ restaurantID: restaurant, customer: customerSession.customer._id })
			.sort({ createdAt: -1 })
			.limit(30)
			.populate("products.product")
			.lean(),
	]);

	if (!customer) redirect(`/${restaurant}/account/login`);

	const newsletterStatus = customer.newsletter?.status ?? "NOT_REQUESTED";
	const displayName = customer.fname?.trim() ? `Hallo ${customer.fname}` : "Willkommen in deinem Konto";

	return (
		<main className="customerAccountPage">
			<header className="accountHeader">
				<div>
					<span>Platzhirsch</span>
					<h1>{displayName}</h1>
					<p>Dein Konto, deine Daten und deine letzten Bestellungen.</p>
				</div>
				<Link href={`/${restaurant}?pickup=1&tab=menu`}>Zur Speisekarte</Link>
			</header>

			<AccountProfileForm
				restaurant={restaurant}
				hasPassword={Boolean(customer.passwordHash)}
				initialProfile={{
					fname: customer.fname ?? "",
					lname: customer.lname ?? "",
					phone: customer.phone ?? "",
					email: customer.email ?? "",
					newsletterStatus,
				}}
			/>

			<section className="orderHistory">
				<div className="sectionHeading"><h2>Meine Bestellungen</h2><span>{orders.length}</span></div>
				{orders.length === 0 ? (
					<div className="emptyHistory"><strong>Noch keine Bestellungen</strong><p>Deine zukünftigen Bestellungen erscheinen automatisch hier.</p></div>
				) : (
					<div className="historyList">
						{orders.map((order) => (
							<article className="historyCard" key={order._id.toString()}>
								<div className="historyTopline">
									<div><strong>{new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt as Date))}</strong><span>{order.orderType === "PICKUP" ? "Abholung" : "Im Lokal"}</span></div>
									<div className="historyPrice"><strong>{formatEuro(order.orderTotal || 0)}</strong><span>{stateLabel[order.state] || order.state}</span></div>
								</div>
								<div className="historyProducts">
									{order.products?.map((item: AccountOrderItem, index: number) => {
										const product = item.product as { name?: string } | undefined;
										return <span key={`${order._id}-${index}`}>{item.quantity}× {product?.name || "Produkt"}</span>;
									})}
								</div>
							</article>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
