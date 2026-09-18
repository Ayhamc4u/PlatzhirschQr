"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function ActivateForm({ restaurant, email, token }: { restaurant: string; email: string; token: string }) {
	const started = useRef(false);
	const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
	const [message, setMessage] = useState("Deine E-Mail-Adresse wird bestätigt …");

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (!email || !token) {
			setStatus("error");
			setMessage("Der Aktivierungslink ist unvollständig.");
			return;
		}

		void signIn("customer-activation", { email, token, restaurant, redirect: false }).then((result) => {
			if (result?.error) {
				setStatus("error");
				setMessage("Der Aktivierungslink ist ungültig oder abgelaufen.");
				return;
			}
			setStatus("success");
			setMessage("Deine E-Mail-Adresse ist bestätigt und dein Konto wurde angelegt.");
		});
	}, [email, restaurant, token]);

	return <div className="customerLoginCard">
		<span className="eyebrow">Platzhirsch Kundenkonto</span>
		<h1>{status === "success" ? "Danke!" : status === "error" ? "Link nicht gültig" : "Konto wird aktiviert"}</h1>
		<p>{message}</p>
		{status === "success" && <>
			<a className="accountPrimaryLink" href={`/${restaurant}/account`}>Zu meinem Konto</a>
			<a className="accountSecondaryLink" href={`/${restaurant}?pickup=1&tab=menu`}>Weiter zur Speisekarte</a>
		</>}
		{status === "error" && <a className="accountPrimaryLink" href={`/${restaurant}/account/login`}>Neuen Aktivierungslink anfordern</a>}
	</div>;
}
