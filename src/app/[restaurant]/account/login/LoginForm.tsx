"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ restaurant }: { restaurant: string }) {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [mode, setMode] = useState<"password" | "register" | "code">("password");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [devCode, setDevCode] = useState("");
	const [devLink, setDevLink] = useState("");

	const passwordLogin = async () => {
		setBusy(true); setMessage("");
		const result = await signIn("customer-password", { email, password, restaurant, redirect: false });
		setBusy(false);
		if (result?.error) { setMessage("E-Mail-Adresse oder Passwort ist nicht korrekt."); return; }
		router.replace(`/${restaurant}/account`); router.refresh();
	};

	const requestRegistration = async () => {
		setBusy(true); setMessage(""); setDevLink("");
		try {
			const response = await fetch("/api/customer/account/activation/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, restaurant }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Aktivierungslink konnte nicht versendet werden.");
			setMessage("Wir haben dir einen Aktivierungslink geschickt. Öffne die E-Mail und bestätige deine Adresse.");
			setDevLink(data.developmentLink || "");
		} catch (error) { setMessage(error instanceof Error ? error.message : "Aktivierungslink konnte nicht versendet werden."); }
		finally { setBusy(false); }
	};

	const requestCode = async () => {
		setBusy(true); setMessage(""); setDevCode("");
		try {
			const response = await fetch("/api/customer/login/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Code konnte nicht angefordert werden.");
			setDevCode(data.developmentCode || ""); setMessage("Wir haben dir einen 6-stelligen Anmeldecode geschickt.");
		} catch (error) { setMessage(error instanceof Error ? error.message : "Code konnte nicht angefordert werden."); }
		finally { setBusy(false); }
	};

	const codeLogin = async () => {
		setBusy(true); setMessage("");
		const result = await signIn("customer-login", { email, code, restaurant, redirect: false });
		setBusy(false);
		if (result?.error) { setMessage("Der Code ist ungültig oder abgelaufen."); return; }
		router.replace(`/${restaurant}/account`); router.refresh();
	};

	return <div className="customerLoginCard">
		<span className="eyebrow">Platzhirsch Kundenkonto</span>
		<h1>{mode === "password" ? "Willkommen zurück" : mode === "register" ? "Konto anlegen" : "Login mit Einmalcode"}</h1>
		<p>{mode === "password" ? "Melde dich mit deiner E-Mail-Adresse und deinem Passwort an." : mode === "register" ? "Du brauchst nur deine E-Mail-Adresse. Wir schicken dir einen Aktivierungslink, mit dem du dein Konto bestätigst." : "Falls du dein Passwort gerade nicht verwenden möchtest, kannst du dich einmalig per E-Mail-Code anmelden."}</p>

		{mode === "password" ? <form autoComplete="on" onSubmit={(event) => { event.preventDefault(); void passwordLogin(); }}>
			<label htmlFor="customer-login-email"><span>E-Mail-Adresse</span><input id="customer-login-email" name="username" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.at" /></label>
			<label htmlFor="customer-login-password"><span>Passwort</span><input id="customer-login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
			{message && <div className="loginMessage">{message}</div>}
			<button type="submit" disabled={busy || !email || !password}>{busy ? "Meldet an..." : "Anmelden"}</button>
			<button type="button" className="secondary" disabled={busy} onClick={() => { setMode("register"); setMessage(""); }}>Noch kein Konto? Jetzt Konto anlegen</button>
			<button type="button" className="secondary" disabled={busy} onClick={() => { setMode("code"); setMessage(""); }}>Stattdessen Einmalcode verwenden</button>
		</form> : <>
			<label htmlFor="customer-account-email"><span>E-Mail-Adresse</span><input id="customer-account-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.at" /></label>

			{mode === "register" && <>
				{message && <div className="loginMessage">{message}</div>}
				{devLink && <div className="devCode">Entwicklungslink: <a href={devLink}>E-Mail bestätigen</a></div>}
				<button type="button" disabled={busy || !email} onClick={requestRegistration}>{busy ? "Bitte warten..." : "Konto anlegen"}</button>
				<button type="button" className="secondary" disabled={busy} onClick={() => { setMode("password"); setMessage(""); }}>Ich habe bereits ein Konto</button>
			</>}

			{mode === "code" && <>
				<label htmlFor="customer-login-code"><span>Anmeldecode</span><input id="customer-login-code" name="one-time-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" /></label>
				{message && <div className="loginMessage">{message}</div>}
				{devCode && <div className="devCode">Entwicklungscode: <strong>{devCode}</strong></div>}
				{code.length === 0 ? <button type="button" disabled={busy || !email} onClick={requestCode}>{busy ? "Bitte warten..." : "Code senden"}</button> : <button type="button" disabled={busy || code.length !== 6} onClick={codeLogin}>{busy ? "Meldet an..." : "Mit Code anmelden"}</button>}
				<button type="button" className="secondary" disabled={busy} onClick={() => { setMode("password"); setCode(""); setMessage(""); }}>Zurück zum Passwort-Login</button>
			</>}
		</>}
	</div>;
}
