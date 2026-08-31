require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
const TOKEN = process.env.READY2ORDER_ACCOUNT_TOKEN;
const RESTAURANT_ID = process.env.RESTAURANT_ID || "qrorder";
const API_BASE = process.env.READY2ORDER_API_BASE || "https://api.ready2order.com/v1";

if (!MONGODB_URI) throw new Error("MONGODB_URI missing");
if (!TOKEN) throw new Error("READY2ORDER_ACCOUNT_TOKEN missing");

const menuSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const profileSchema = new mongoose.Schema({}, { strict: false });

const Menus = mongoose.models.menus || mongoose.model("menus", menuSchema);
const Profiles = mongoose.models.profiles || mongoose.model("profiles", profileSchema);

function slugifyCategory(value) {
  return String(value || "Sonstiges")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapCategory(product) {
  return slugifyCategory(product?.productgroup?.productgroup_name);
}

async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products?limit=500&includeProductGroup=true`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`ready2order error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  console.log("Mongo URI DB:", mongoose.connection.name);
  console.log("Restaurant ID:", RESTAURANT_ID);

  const rawProducts = await fetchProducts();
  console.log(`Fetched ${rawProducts.length} products`);

  const products = rawProducts.filter((p) => {
    const groupActive = p.productgroup?.productgroup_active !== 0;
    const productActive = p.product_active === true;
    const notSoldOut = p.product_soldOut !== true;

    return groupActive && productActive && notSoldOut;
  });

  console.log(`Importable active products: ${products.length}`);

  const categories = [...new Set(products.map((p) => mapCategory(p)))];

  await Profiles.updateOne(
    { restaurantID: RESTAURANT_ID },
    { $addToSet: { categories: { $each: categories } } }
  );

  await Menus.updateMany(
    { restaurantID: RESTAURANT_ID },
    { $set: { hidden: true } }
  );

  let imported = 0;

  for (const p of products) {
    const category = mapCategory(p);

    await Menus.updateOne(
      { restaurantID: RESTAURANT_ID, ready2orderProductId: p.product_id },
      {
        $set: {
          restaurantID: RESTAURANT_ID,
          ready2orderProductId: p.product_id,
          ready2orderProductType: p.product_type,
          ready2orderUpdatedAt: p.product_updated_at ? new Date(p.product_updated_at) : null,
          ready2orderProductGroupId: p.productgroup?.productgroup_id ?? null,
          ready2orderProductGroupName: p.productgroup?.productgroup_name ?? "",
          name: p.product_name,
          description: p.product_description || "",
          category,
          price: p.product_price,
          taxPercent: p.product_vat,
          veg: p.product_type === "food" ? "non-veg" : "veg",
          hidden: false,
          image: p.images?.[0]?.url || "",
        },
      },
      { upsert: true }
    );

    imported++;
  }

  console.log(`Imported/updated ${imported} menu items`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});