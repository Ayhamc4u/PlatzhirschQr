import net from "node:net";
import tls from "node:tls";

type SmtpSocket = net.Socket | tls.TLSSocket;

function readSmtpResponse(socket: SmtpSocket) {
	return new Promise<string>((resolve, reject) => {
		let buffer = "";
		const cleanup = () => {
			socket.off("data", onData);
			socket.off("error", onError);
			socket.off("close", onClose);
		};
		const onError = (error: Error) => { cleanup(); reject(error); };
		const onClose = () => { cleanup(); reject(new Error("SMTP connection closed unexpectedly")); };
		const onData = (chunk: Buffer | string) => {
			buffer += chunk.toString();
			const lines = buffer.split(/\r?\n/).filter(Boolean);
			if (lines.some((line) => /^\d{3} /.test(line))) { cleanup(); resolve(buffer); }
		};
		socket.on("data", onData);
		socket.on("error", onError);
		socket.on("close", onClose);
	});
}

async function smtpCommand(socket: SmtpSocket, command: string | null, expectedCodes: number[]) {
	if (command !== null) socket.write(`${command}\r\n`);
	const response = await readSmtpResponse(socket);
	const code = Number(response.slice(0, 3));
	if (!expectedCodes.includes(code)) throw new Error(`SMTP command failed with ${code}`);
	return response;
}

async function connectSmtp(host: string, port: number, secure: boolean) {
	if (secure) {
		const socket = tls.connect({ host, port, servername: host });
		await new Promise<void>((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
		return socket;
	}
	const socket = net.createConnection({ host, port });
	await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
	return socket;
}

function extractAddress(from: string) {
	return from.match(/<([^>]+)>/)?.[1]?.trim() || from.trim();
}

export async function sendHtmlEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
	const host = process.env.EMAIL_SMTP_HOST?.trim();
	const port = Number(process.env.EMAIL_SMTP_PORT || "587");
	const secure = process.env.EMAIL_SMTP_SECURE === "true";
	const username = process.env.EMAIL_SMTP_USER?.trim();
	const password = process.env.EMAIL_SMTP_PASSWORD;
	const from = process.env.AUTH_EMAIL_FROM?.trim();
	if (!host || !Number.isInteger(port) || !username || !password || !from) return false;

	let socket = await connectSmtp(host, port, secure);
	try {
		await smtpCommand(socket, null, [220]);
		await smtpCommand(socket, `EHLO ${host}`, [250]);
		if (!secure) {
			await smtpCommand(socket, "STARTTLS", [220]);
			const tlsSocket = tls.connect({ socket, servername: host });
			await new Promise<void>((resolve, reject) => { tlsSocket.once("secureConnect", resolve); tlsSocket.once("error", reject); });
			socket = tlsSocket;
			await smtpCommand(socket, `EHLO ${host}`, [250]);
		}
		await smtpCommand(socket, "AUTH LOGIN", [334]);
		await smtpCommand(socket, Buffer.from(username).toString("base64"), [334]);
		await smtpCommand(socket, Buffer.from(password).toString("base64"), [235]);
		await smtpCommand(socket, `MAIL FROM:<${extractAddress(from)}>`, [250]);
		await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
		await smtpCommand(socket, "DATA", [354]);
		const message = [
			`From: ${from}`,
			`To: ${to}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
			"Content-Type: text/html; charset=UTF-8",
			"Content-Transfer-Encoding: 8bit",
			"",
			html.replace(/^\./gm, ".."),
		].join("\r\n");
		socket.write(`${message}\r\n.\r\n`);
		const response = await readSmtpResponse(socket);
		if (Number(response.slice(0, 3)) !== 250) throw new Error("SMTP message rejected");
		socket.write("QUIT\r\n");
		return true;
	} finally {
		socket.end();
	}
}
