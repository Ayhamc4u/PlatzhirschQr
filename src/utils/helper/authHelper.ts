import crypto from "node:crypto";
import pick from "lodash/pick";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import connectDB from "#utils/database/connect";
import { Accounts, type TAccount } from "#utils/database/models/account";
import { CustomerActivationTokens } from "#utils/database/models/customerActivationToken";
import { Customers } from "#utils/database/models/customer";
import { CustomerLoginCodes } from "#utils/database/models/customerLoginCode";

import { isEmailValid } from "./common";
import { verifyPassword } from "./passwordHelper";

const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 90;
const NEWSLETTER_CONSENT_VERSION = "2026-09";
const ADMIN_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_LOCK_MINUTES = [10, 30, 60, 120, 240] as const;
const hashLoginCode = (email: string, code: string) => crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET || "platzhirsch-dev").update(`${email}:${code}`).digest("hex");
const hashActivationToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const customerUser = (customer: { _id: { toString(): string }; toObject(): object }, restaurant?: string) => ({
	id: customer._id.toString(),
	role: "customer",
	themeColor: "",
	_doc: { role: "customer", customer: customer.toObject(), restaurant: { username: restaurant || "platzhirsch" } } as never,
}) as any;

const registerAdminLoginFailure = async (account: TAccount) => {
	const now = new Date();
	const lastFailedAt = account.lastFailedLoginAt ? new Date(account.lastFailedLoginAt).getTime() : 0;
	const withinWindow = lastFailedAt > 0 && now.getTime() - lastFailedAt <= ADMIN_FAILURE_WINDOW_MS;
	const attempts = (withinWindow ? account.failedLoginAttempts ?? 0 : 0) + 1;

	account.lastFailedLoginAt = now;
	if (attempts >= 3) {
		const currentLevel = Math.max(0, account.loginLockLevel ?? 0);
		const lockMinutes = ADMIN_LOCK_MINUTES[Math.min(currentLevel, ADMIN_LOCK_MINUTES.length - 1)];
		account.failedLoginAttempts = 0;
		account.loginLockLevel = Math.min(currentLevel + 1, ADMIN_LOCK_MINUTES.length - 1);
		account.loginLockedUntil = new Date(now.getTime() + lockMinutes * 60_000);
	} else {
		account.failedLoginAttempts = attempts;
	}
	await account.save();
};

const clearAdminLoginFailures = async (account: TAccount) => {
	if (!account.failedLoginAttempts && !account.lastFailedLoginAt && !account.loginLockedUntil && !account.loginLockLevel) return;
	account.failedLoginAttempts = 0;
	account.loginLockLevel = 0;
	account.lastFailedLoginAt = undefined;
	account.loginLockedUntil = undefined;
	await account.save();
};

export const authOptions: AuthOptions = {
	secret: process.env.NEXTAUTH_SECRET,
	providers: [
		CredentialsProvider({
			id: "restaurant", name: "restaurant",
			credentials: { username: { label: "Username", type: "text" }, kitchen: { label: "Kitchen Username", type: "text" }, password: { label: "Password", type: "password" } },
			async authorize(cred) {
				if (!cred?.username || !cred?.password) throw new Error("Credentials required");
				await connectDB();
				const credential = isEmailValid(cred.username) ? { email: cred.username } : { username: cred.username };
				const account = await Accounts.findOne<TAccount>(credential).populate("profile").populate({ path: "kitchens", match: { username: cred.kitchen } });
				if (!account) throw new Error("Invalid credentials");
				if (cred.kitchen) {
					if (!(await verifyPassword(cred.password, account?.kitchens?.[0]?.password))) throw new Error("Invalid kitchen credentials");
					return { id: account._id.toString(), role: "kitchen", themeColor: account?.profile?.themeColor, _doc: account as unknown as TAccount };
				}

				const lockedUntil = account.loginLockedUntil ? new Date(account.loginLockedUntil) : null;
				if (lockedUntil && lockedUntil.getTime() > Date.now()) throw new Error("Admin login temporarily locked");
				if (lockedUntil && lockedUntil.getTime() <= Date.now()) {
					account.loginLockedUntil = undefined;
					await account.save();
				}

				if (!(await verifyPassword(cred.password, account?.password))) {
					await registerAdminLoginFailure(account);
					throw new Error("Invalid admin credentials");
				}
				await clearAdminLoginFailures(account);
				return { id: account._id.toString(), role: "admin", themeColor: account?.profile?.themeColor, _doc: account as unknown as TAccount };
			},
		}),
		CredentialsProvider({
			id: "customer-activation", name: "customer-activation",
			credentials: { email: { label: "Email", type: "email" }, token: { label: "Token", type: "text" }, restaurant: { label: "Restaurant", type: "text" } },
			async authorize(cred) {
				const email = cred?.email?.trim().toLowerCase();
				const token = cred?.token?.trim();
				if (!email || !isEmailValid(email) || !token) throw new Error("Ungültiger Aktivierungslink");
				await connectDB();
				const activation = await CustomerActivationTokens.findOne({ email, tokenHash: hashActivationToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
				if (!activation) throw new Error("Aktivierungslink ist ungültig oder abgelaufen");
				let customer = await Customers.findOne({ email });
				if (!customer) {
					customer = new Customers({ email, emailNormalized: email, accountEnabled: true, accountStatus: "ACTIVE", emailVerifiedAt: new Date(), accountActivatedAt: new Date(), lastLoginAt: new Date() });
				} else {
					customer.emailNormalized = email;
					customer.accountEnabled = true;
					customer.accountStatus = "ACTIVE";
					customer.emailVerifiedAt ??= new Date();
					customer.accountActivatedAt ??= new Date();
					customer.lastLoginAt = new Date();
				}
				await customer.save();
				activation.usedAt = new Date();
				await activation.save();
				return customerUser(customer, cred?.restaurant);
			},
		}),
		CredentialsProvider({
			id: "customer-password", name: "customer-password",
			credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" }, restaurant: { label: "Restaurant", type: "text" } },
			async authorize(cred) {
				const email = cred?.email?.trim().toLowerCase();
				const password = cred?.password || "";
				if (!email || !isEmailValid(email) || !password) throw new Error("Ungültige Anmeldedaten");
				await connectDB();
				const customer = await Customers.findOne({ email, accountEnabled: true, accountStatus: "ACTIVE", emailVerifiedAt: { $exists: true }, accountActivatedAt: { $exists: true } }).select("+passwordHash");
				if (!customer || !(await verifyPassword(password, customer.passwordHash))) throw new Error("Ungültige Anmeldedaten");
				customer.lastLoginAt = new Date();
				await customer.save();
				return customerUser(customer, cred?.restaurant);
			},
		}),
		CredentialsProvider({
			id: "customer-login", name: "customer-login",
			credentials: { email: { label: "Email", type: "email" }, code: { label: "Code", type: "text" }, restaurant: { label: "Restaurant", type: "text" } },
			async authorize(cred) {
				const email = cred?.email?.trim().toLowerCase();
				const code = cred?.code?.trim();
				if (!email || !isEmailValid(email) || !code || !/^\d{6}$/.test(code)) throw new Error("Ungültiger Anmeldecode");
				await connectDB();
				const loginCode = await CustomerLoginCodes.findOne({ email, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
				if (!loginCode || loginCode.attempts >= 5) throw new Error("Code ist ungültig oder abgelaufen");
				loginCode.attempts += 1;
				if (loginCode.codeHash !== hashLoginCode(email, code)) { await loginCode.save(); throw new Error("Code ist ungültig oder abgelaufen"); }
				const customer = await Customers.findOne({ email, accountEnabled: true, accountStatus: "ACTIVE" });
				if (!customer) throw new Error("Kundenkonto nicht gefunden");
				loginCode.usedAt = new Date(); await loginCode.save();
				customer.lastLoginAt = new Date(); customer.emailVerifiedAt ??= new Date(); await customer.save();
				return customerUser(customer, cred?.restaurant);
			},
		}),
		CredentialsProvider({
			id: "customer", name: "customer",
			credentials: { restaurant: { label: "Restaurant Username", type: "text" }, table: { label: "Table ID", type: "string" }, phone: { label: "Phone Number", type: "text" }, fname: { label: "First name", type: "text" }, lname: { label: "Last name", type: "text" }, email: { label: "Email", type: "email" }, rememberAccount: { label: "Remember account", type: "text" }, newsletterOptIn: { label: "Newsletter opt-in", type: "text" } },
			async authorize(cred) {
				if (!cred?.restaurant || !cred?.table || !cred?.fname || !cred?.lname || !cred?.phone) throw new Error("Customer data required");
				await connectDB();
				const phoneNormalized = cred.phone.trim(); const emailNormalized = cred.email?.trim().toLowerCase() || undefined; const rememberAccount = cred.rememberAccount === "true"; const newsletterOptIn = cred.newsletterOptIn === "true";
				if (emailNormalized && !isEmailValid(emailNormalized)) throw new Error("Invalid email address");
				let customer = await Customers.findOne({ phone: phoneNormalized });
				if (emailNormalized) { const emailOwner = await Customers.findOne({ email: emailNormalized }); if (emailOwner && (!customer || emailOwner._id.toString() !== customer._id.toString())) throw new Error("Email address is already in use"); }
				if (!customer) customer = new Customers({ fname: cred.fname.trim(), lname: cred.lname.trim(), phone: phoneNormalized, phoneNormalized, email: emailNormalized, emailNormalized, accountEnabled: rememberAccount, lastLoginAt: new Date(), newsletter: newsletterOptIn ? { status: "PENDING", requestedAt: new Date(), consentVersion: NEWSLETTER_CONSENT_VERSION, source: "pickup-checkout" } : { status: "NOT_REQUESTED" } });
				else { customer.fname = cred.fname.trim(); customer.lname = cred.lname.trim(); customer.phone = phoneNormalized; customer.phoneNormalized = phoneNormalized; if (emailNormalized) { customer.email = emailNormalized; customer.emailNormalized = emailNormalized; } if (rememberAccount) customer.accountEnabled = true; customer.lastLoginAt = new Date(); if (newsletterOptIn && customer.newsletter?.status !== "SUBSCRIBED") customer.newsletter = { status: "PENDING", requestedAt: new Date(), consentVersion: NEWSLETTER_CONSENT_VERSION, source: "pickup-checkout" }; }
				await customer.save();
				const account = await Accounts.findOne<TAccount>({ username: cred.restaurant }).populate("profile").populate("tables");
				if (!account || !account?.tables?.some?.(({ username }: { username: string }) => username === cred.table)) throw new Error("Invalid restaurant/table");
				return { id: customer._id.toString(), role: "customer", themeColor: account?.profile?.themeColor, _doc: { role: "customer", customer: customer.toObject(), restaurant: { username: account?.profile?.restaurantID, table: cred.table, name: account?.profile?.name, avatar: account?.profile?.avatar } } as never };
			},
		}),
	],
	session: { strategy: "jwt", maxAge: CUSTOMER_SESSION_MAX_AGE }, jwt: { maxAge: CUSTOMER_SESSION_MAX_AGE },
	callbacks: {
		async session({ session, token }) { session = { ...session, ...(token as any)?.user }; delete session.user; return session; },
		async jwt({ token, user, account }) {
			if (account?.provider === "restaurant" && user) (token as any).user = { role: user.role, themeColor: user.themeColor, authIssuedAt: Date.now(), ...pick(user._doc, ["email", "accountActive", "subscriptionActive", "username", "verified"]) };
			if (["customer", "customer-login", "customer-password", "customer-activation"].includes(account?.provider || "") && user) (token as any).user = { ...(user._doc as object), authIssuedAt: Date.now() };
			return token;
		},
	},
};
