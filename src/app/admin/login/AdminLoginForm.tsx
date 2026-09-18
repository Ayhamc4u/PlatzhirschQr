"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");

	const submit = async () => {
		setBusy(true);
		setMessage("");
		const result = await signIn("restaurant", {
			username: username.trim(),
			password,
			redirect: false,
			callbackUrl: "/dashboard",
		});
		setBusy(false);

		if (result?.error) {
			setMessage("Anmeldung fehlgeschlagen. Nach 3 Fehlversuchen wird der Admin-Zugang vorübergehend gesperrt.");
			return;
		}

		router.replace("/dashboard");
		router.refresh();
	};

	return (
		<form
			className="adminLoginForm"
			autoComplete="on"
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<label htmlFor="admin-username">
				<span>Benutzername oder E-Mail</span>
				<input
					id="admin-username"
					name="username"
					type="text"
					autoComplete="username"
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					placeholder="platzhirsch"
					required
					autoFocus
				/>
			</label>

			<label htmlFor="admin-password">
				<span>Passwort</span>
				<input
					id="admin-password"
					name="password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
				/>
			</label>

			{message && <div className="adminLoginMessage" role="alert">{message}</div>}

			<button type="submit" disabled={busy || !username.trim() || !password}>
				{busy ? "Anmeldung läuft…" : "Anmelden"}
			</button>

			<p className="adminLoginHint">Sicherheitsregel: 3 falsche Versuche innerhalb von 10 Minuten lösen eine Sperre aus. Weitere Sperren werden schrittweise länger.</p>
		</form>
	);
}
