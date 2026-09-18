import ActivateForm from "./ActivateForm";
import "../login/login.scss";

export default async function ActivatePage({ params, searchParams }: { params: Promise<{ restaurant: string }>; searchParams: Promise<{ email?: string; token?: string }> }) {
	const { restaurant } = await params;
	const { email = "", token = "" } = await searchParams;
	return <main className="customerLoginPage"><ActivateForm restaurant={restaurant} email={email} token={token} /></main>;
}
