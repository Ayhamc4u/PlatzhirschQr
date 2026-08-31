require("dotenv").config({ path: ".env.local" });

const token = process.env.READY2ORDER_ACCOUNT_TOKEN;
const apiBase = process.env.READY2ORDER_API_BASE || "https://api.ready2order.com/v1";

if (!token) {
  throw new Error("READY2ORDER_ACCOUNT_TOKEN missing");
}

async function main() {
  const res = await fetch(`${apiBase}/products?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await res.json();

  console.log("Status:", res.status);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
