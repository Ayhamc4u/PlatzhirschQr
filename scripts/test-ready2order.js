const token = process.env.READY2ORDER_ACCOUNT_TOKEN;

async function main() {
  const res = await fetch("https://api.ready2order.com/v1/products?limit=5", {
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
