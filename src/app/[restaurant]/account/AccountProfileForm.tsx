"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

type Profile = {
	fname: string;
	lname: string;
	phone: string;
	email: string;
	newsletterStatus: "NOT_REQUESTED" | "PENDING" | "SUBSCRIBED" | "UNSUBSCRIBED";
};

export default function AccountProfileForm({ initialProfile, restaurant, hasPassword: initialHasPassword }: { initialProfile: Profile; restaurant: string; hasPassword: boolean }) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [profile, setProfile] = useState(initialProfile);
	const [draft, setDraft] = useState(initialProfile);
	const [hasPassword, setHasPassword] = useState(initialHasPassword);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordBusy, setPasswordBusy] = useState(false);

	const newsletterEnabled = draft.newsletterStatus === "PENDING" || draft.newsletterStatus === "SUBSCRIBED";

	const save = async () => {
		setBusy(true);
		try {
			const response = await fetch("/api/customer/profile", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fname: draft.fname, lname: draft.lname, phone: draft.phone, newsletterOptIn: newsletterEnabled }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Änderungen konnten nicht gespeichert werden.");
			setProfile(data.customer);
			setDraft(data.customer);
			setEditing(false);
			toast.success("Deine Daten wurden gespeichert.");
			router.refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Änderungen konnten nicht gespeichert werden.");
		} finally {
			setBusy(false);
		}
	};

	const savePassword = async () => {
		if (password.length < 8) return toast.error("Das Passwort muss mindestens 8 Zeichen lang sein.");
		if (password !== confirmPassword) return toast.error("Die Passwörter stimmen nicht überein.");
		setPasswordBusy(true);
		try {
			const response = await fetch("/api/customer/account/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || "Passwort konnte nicht gespeichert werden.");
			setHasPassword(true);
			setPassword("");
			setConfirmPassword("");
			toast.success("Dein Passwort wurde gespeichert.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Passwort konnte nicht gespeichert werden.");
		} finally {
			setPasswordBusy(false);
		}
	};

	const cancel = () => { setDraft(profile); setEditing(false); };
	const logout = async () => { await signOut({ callbackUrl: `/${restaurant}?pickup=1&tab=menu` }); };

	return (
		<>
			<section className="accountProfileCard editableProfileCard">
				<div className="profileCardHeading">
					<div><small>Mein Konto</small><strong>Persönliche Daten</strong></div>
					{!editing && <button type="button" className="profileEditButton" onClick={() => setEditing(true)}>Bearbeiten</button>}
				</div>

				{editing ? <>
					<div className="profileFormGrid">
						<label><span>Vorname (optional)</span><input autoComplete="given-name" value={draft.fname} onChange={(event) => setDraft({ ...draft, fname: event.target.value })} /></label>
						<label><span>Nachname (optional)</span><input autoComplete="family-name" value={draft.lname} onChange={(event) => setDraft({ ...draft, lname: event.target.value })} /></label>
						<label><span>E-Mail</span><input type="email" value={draft.email} disabled /></label>
						<label><span>Telefon (optional)</span><input type="tel" autoComplete="tel" placeholder="+43..." value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
					</div>
					<label className="newsletterSetting"><input type="checkbox" checked={newsletterEnabled} onChange={(event) => setDraft({ ...draft, newsletterStatus: event.target.checked ? "PENDING" : "UNSUBSCRIBED" })} /><span><strong>Newsletter</strong><small>{draft.newsletterStatus === "SUBSCRIBED" ? "Du erhältst Neuigkeiten und Angebote." : "Für Neuigkeiten und Angebote anmelden."}</small></span></label>
					<div className="profileActions"><button type="button" className="profileSaveButton" disabled={busy} onClick={save}>{busy ? "Speichert..." : "Änderungen speichern"}</button><button type="button" className="profileCancelButton" disabled={busy} onClick={cancel}>Abbrechen</button></div>
				</> : <>
					<div className="profileOverviewGrid">
						<div><small>Name</small><strong>{[profile.fname, profile.lname].filter(Boolean).join(" ") || "Noch nicht hinterlegt"}</strong></div>
						<div><small>E-Mail</small><strong>{profile.email}</strong></div>
						<div><small>Telefon</small><strong>{profile.phone || "Noch nicht hinterlegt"}</strong></div>
						<div><small>Newsletter</small><strong>{profile.newsletterStatus === "SUBSCRIBED" ? "Angemeldet" : profile.newsletterStatus === "PENDING" ? "Bestätigung ausständig" : "Nicht angemeldet"}</strong></div>
					</div>
					<div className="accountSessionActions"><button type="button" className="logoutButton" onClick={logout}>Abmelden</button></div>
				</>}
			</section>

			<section className="accountProfileCard editableProfileCard">
				<div className="profileCardHeading"><div><small>Sicherheit</small><strong>{hasPassword ? "Passwort ändern" : "Passwort festlegen"}</strong></div></div>
				<p>{hasPassword ? "Du kannst dein Passwort jederzeit ändern." : "Optional: Lege ein Passwort fest, damit du dich künftig direkt mit E-Mail und Passwort anmelden kannst."}</p>
				<form onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
					<input className="passwordManagerUsername" type="email" name="username" autoComplete="username" value={profile.email} readOnly aria-hidden="true" tabIndex={-1} />
					<div className="profileFormGrid">
						<label><span>Neues Passwort</span><input type="password" name="new-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" /></label>
						<label><span>Passwort wiederholen</span><input type="password" name="new-password-confirmation" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
					</div>
					<div className="profileActions"><button type="submit" className="profileSaveButton" disabled={passwordBusy || password.length < 8 || confirmPassword.length < 8}>{passwordBusy ? "Speichert..." : hasPassword ? "Passwort ändern" : "Passwort speichern"}</button></div>
				</form>
			</section>
		</>
	);
}
