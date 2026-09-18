import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "#utils/helper/authHelper";

import AdminLoginForm from "./AdminLoginForm";
import "./admin-login.scss";

export const metadata = {
	title: "Admin Login • Platzhirsch",
};

export default async function AdminLoginPage() {
	const session = await getServerSession(authOptions);
	if (session?.role === "admin") redirect("/dashboard");

	return (
		<main className="adminLoginPage">
			<section className="adminLoginCard" aria-labelledby="admin-login-title">
				<span className="adminLoginEyebrow">Platzhirsch Verwaltung</span>
				<h1 id="admin-login-title">Admin Login</h1>
				<p>Melde dich mit deinem Admin-Benutzernamen oder deiner E-Mail-Adresse an.</p>
				<AdminLoginForm />
			</section>
		</main>
	);
}
