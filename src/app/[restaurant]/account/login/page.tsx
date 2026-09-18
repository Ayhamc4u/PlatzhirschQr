import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "#utils/helper/authHelper";
import LoginForm from "./LoginForm";
import "./login.scss";

export default async function CustomerLoginPage({ params }: { params: Promise<{ restaurant: string }> }) {
	const { restaurant } = await params;
	const session = await getServerSession(authOptions) as { role?: string } | null;
	if (session?.role === "customer") redirect(`/${restaurant}/account`);
	return <main className="customerLoginPage"><LoginForm restaurant={restaurant} /></main>;
}
