import { usePathname, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { toast } from "react-toastify";
import { Button, Textfield } from "xtreme-ui";

import "./userLogin.scss";

const mobileNumberPattern = /^\+[0-9]{8,15}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_COUNTRIES = [
	{ code: "AT", name: "Österreich", dialCode: "43", favorite: true },
	{ code: "DE", name: "Deutschland", dialCode: "49", favorite: true },
	{ code: "CZ", name: "Tschechien", dialCode: "420", favorite: true },
	{ code: "SK", name: "Slowakei", dialCode: "421", favorite: false },
	{ code: "CH", name: "Schweiz", dialCode: "41", favorite: false },
	{ code: "IT", name: "Italien", dialCode: "39", favorite: false },
	{ code: "HU", name: "Ungarn", dialCode: "36", favorite: false },
	{ code: "SI", name: "Slowenien", dialCode: "386", favorite: false },
	{ code: "HR", name: "Kroatien", dialCode: "385", favorite: false },
	{ code: "PL", name: "Polen", dialCode: "48", favorite: false },
] as const;

const UserLogin = ({ setOpen, tableOverride, pickup = false, onSuccess }: UserLoginProps) => {
	const pathname = usePathname();
	const params = useSearchParams();
	const [busy, setBusy] = useState(false);
	const [countryCode, setCountryCode] = useState("AT");
	const [phone, setPhone] = useState("");
	const [fname, setFName] = useState("");
	const [lname, setLName] = useState("");
	const [email, setEmail] = useState("");
	const [rememberAccount, setRememberAccount] = useState(false);
	const [newsletterOptIn, setNewsletterOptIn] = useState(false);

	const selectedCountry = PHONE_COUNTRIES.find((country) => country.code === countryCode) ?? PHONE_COUNTRIES[0];
	const normalizedLocalNumber = phone.replace(/\D/g, "").replace(/^0+/, "");
	const phoneNumber = `+${selectedCountry.dialCode}${normalizedLocalNumber}`;
	const normalizedEmail = email.trim().toLowerCase();
	const emailRequired = rememberAccount || newsletterOptIn;
	const table = tableOverride ?? params.get("table");
	const restaurant = pathname.replaceAll("/", "");

	const onSubmit = async () => {
		if (!table) return toast.error(pickup ? "Kein Abholplatz verfügbar" : "Bitte den QR-Code am Tisch scannen");
		if (!fname.trim() || !lname.trim()) return toast.error("Bitte Vor- und Nachname eingeben");
		if (!mobileNumberPattern.test(phoneNumber)) return toast.error("Bitte eine gültige Telefonnummer eingeben");
		if (emailRequired && !emailPattern.test(normalizedEmail)) return toast.error("Bitte eine gültige E-Mail-Adresse eingeben");
		if (normalizedEmail && !emailPattern.test(normalizedEmail)) return toast.error("Bitte eine gültige E-Mail-Adresse eingeben");

		setBusy(true);
		const res = await signIn("customer", {
			redirect: false,
			restaurant,
			phone: phoneNumber,
			fname: fname.trim(),
			lname: lname.trim(),
			email: normalizedEmail,
			rememberAccount: String(rememberAccount),
			newsletterOptIn: String(newsletterOptIn),
			table,
			callbackUrl: `${window.location.origin}`,
		});

		if (res?.error) toast.error(res.error);
		else {
			if (rememberAccount && normalizedEmail) {
				fetch("/api/customer/account/activation/request", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email: normalizedEmail, restaurant }),
				}).catch(() => undefined);
				toast.info("Wir schicken dir einen Aktivierungslink für dein Stammkundenkonto per E-Mail.");
			}
			setOpen(false);
			onSuccess?.();
		}
		setBusy(false);
	};

	return (
		<div className="userLogin simpleCustomerDetails">
			<div className="header">
				<span className="heading"><span>{pickup ? "Abholung" : "Bestellen"}</span> starten</span>
				<p>{pickup ? "Nur kurz deine Kontaktdaten – falls wir zur Bestellung eine Rückfrage haben." : "Deine Kontaktdaten für die Bestellung."}</p>
			</div>
			<div className="content">
				<div className="nameRow">
					<Textfield id="user-login-fname" className="fName" placeholder="Vorname" autoComplete="given-name" value={fname} onChange={(e: ChangeEvent<HTMLInputElement>) => setFName(e.target.value)} />
					<Textfield id="user-login-lname" className="lName" placeholder="Nachname" autoComplete="family-name" value={lname} onChange={(e: ChangeEvent<HTMLInputElement>) => setLName(e.target.value)} />
				</div>
				<div className="phoneEntry">
					<label className="countrySelect" htmlFor="user-login-country">
						<span>Land</span>
						<select id="user-login-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
							<optgroup label="Favoriten">
								{PHONE_COUNTRIES.filter((country) => country.favorite).map((country) => <option key={country.code} value={country.code}>{country.name} (+{country.dialCode})</option>)}
							</optgroup>
							<optgroup label="Weitere Länder">
								{PHONE_COUNTRIES.filter((country) => !country.favorite).map((country) => <option key={country.code} value={country.code}>{country.name} (+{country.dialCode})</option>)}
							</optgroup>
						</select>
					</label>
					<div className="phoneInput">
						<span className="dialCode">+{selectedCountry.dialCode}</span>
						<Textfield id="user-login-phone" className="phone" type="text" placeholder="Telefonnummer" autoComplete="tel-national" inputMode="tel" value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} />
					</div>
				</div>
				<div className="accountEmailRow">
					<Textfield id="user-login-email" className="email" type="email" placeholder={emailRequired ? "E-Mail *" : "E-Mail (optional)"} autoComplete="email" required={emailRequired} aria-required={emailRequired} value={email} onEnterKey={onSubmit} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
				</div>
				<div className="customerOptions">
					<label><input type="checkbox" checked={rememberAccount} onChange={(event) => setRememberAccount(event.target.checked)} /><span><strong>Für das nächste Mal merken</strong><small>Du erhältst einmalig einen Aktivierungslink per E-Mail und legst danach dein Passwort fest.</small></span></label>
					<label><input type="checkbox" checked={newsletterOptIn} onChange={(event) => setNewsletterOptIn(event.target.checked)} /><span><strong>Newsletter erhalten</strong><small>Neuigkeiten und Angebote per E-Mail. Die Anmeldung wird später per E-Mail bestätigt.</small></span></label>
				</div>
			</div>
			<div className="footer">
				<Button label="Weiter" onClick={onSubmit} loading={busy} />
			</div>
		</div>
	);
};

export default UserLogin;

type UserLoginProps = {
	setOpen: (open: boolean) => void;
	tableOverride?: string | null;
	pickup?: boolean;
	onSuccess?: () => void;
};
