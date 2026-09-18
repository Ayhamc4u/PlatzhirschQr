require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
const RESTAURANT_ID = process.env.RESTAURANT_ID || "qrorder";
const DEFAULT_PICKUP_CATEGORIES = new Set(["burger", "pizza", "snacks", "salate", "nachspeisen", "oel", "most", "wein"]);

if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

const menuSchema = new mongoose.Schema({}, { strict: false, timestamps: true, collection: "menus" });
const readyProductSchema = new mongoose.Schema({}, { strict: false, collection: "ready_products" });

const Menus = mongoose.models.MenuSync || mongoose.model("MenuSync", menuSchema);
const ReadyProducts = mongoose.models.ReadyProductMenuSync || mongoose.model("ReadyProductMenuSync", readyProductSchema);

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

function normalizeVariations(raw) {
  if (!Array.isArray(raw.productvariation)) return [];

  return raw.productvariation
    .map((variation) => ({
      productId: Number(variation.variation_id ?? variation.product_id),
      name: String(variation.variation_name ?? variation.product_name ?? "").trim(),
      price: Number(variation.variation_price ?? variation.product_price ?? 0),
    }))
    .filter((variation) => Number.isFinite(variation.productId) && variation.productId > 0 && variation.name && Number.isFinite(variation.price));
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  console.log("MongoDB:", mongoose.connection.name);
  console.log("Restaurant:", RESTAURANT_ID);

  const accounts = mongoose.connection.collection("accounts");
  const profiles = mongoose.connection.collection("profiles");
  const account = await accounts.findOne({ username: RESTAURANT_ID });

  if (!account) throw new Error(`Account '${RESTAURANT_ID}' not found`);

  const products = await ReadyProducts.find({ restaurantID: RESTAURANT_ID }).lean();
  console.log("Ready2order-Produkte:", products.length);

  if (products.length === 0) {
    throw new Error("No synced Ready2order products found. Run sync-ready2order-products.js first.");
  }

  const activeProducts = products.filter((product) => {
    const raw = product.data;
    return raw?.product_active !== false && raw?.product_soldOut !== true;
  });

  const categories = new Set();
  const syncTime = new Date();
  let productsWithVariations = 0;
  const operations = activeProducts.map((product) => {
    const raw = product.data || {};
    const groupName = raw.productgroup?.productgroup_name || "Sonstiges";
    const groupId = raw.productgroup?.productgroup_id ?? null;
    const category = slugifyCategory(groupName);
    const ready2orderVariations = normalizeVariations(raw);
    if (ready2orderVariations.length) productsWithVariations += 1;
    categories.add(category);

    const initialOrderTypes = DEFAULT_PICKUP_CATEGORIES.has(category) ? ["DINE_IN", "PICKUP"] : ["DINE_IN"];

    return {
      updateOne: {
        filter: {
          restaurantID: RESTAURANT_ID,
          ready2orderProductId: product.ready2orderProductId,
        },
        update: {
          $set: {
            restaurantID: RESTAURANT_ID,
            ready2orderProductId: product.ready2orderProductId,
            ready2orderProductType: raw.product_type ?? null,
            ready2orderProductTypeId: raw.product_type_id ?? null,
            ready2orderProductGroupId: groupId,
            ready2orderProductGroupName: groupName,
            ready2orderUpdatedAt: product.sourceUpdatedAt ?? null,
            ready2orderVariations,
            name: raw.product_name ?? "",
            description: raw.product_description ?? "",
            category,
            price: raw.product_price ?? 0,
            taxPercent: raw.product_vat ?? 0,
            hidden: false,
            soldOut: raw.product_soldOut === true,
            sortIndex: raw.product_sortIndex ?? 0,
            image: raw.images?.[0]?.url ?? raw.images?.[0]?.image_url ?? "",
            veg: raw.product_type === "food" ? "non-veg" : "veg",
            syncedAt: syncTime,
          },
          $setOnInsert: {
            availableOrderTypes: initialOrderTypes,
          },
        },
        upsert: true,
      },
    };
  });

  await Menus.updateMany({ restaurantID: RESTAURANT_ID }, { $set: { hidden: true } });

  const result = await Menus.bulkWrite(operations, { ordered: false });
  console.log("Neu angelegt:", result.upsertedCount);
  console.log("Aktualisiert:", result.modifiedCount);
  console.log("Gefunden:", result.matchedCount);
  console.log("Produkte mit Varianten:", productsWithVariations);

  // Bestehende Menüs einmalig mit sinnvollen Defaults migrieren. Danach wird das Feld
  // bei Synchronisationen bewusst nicht überschrieben, damit spätere Admin-Auswahlen erhalten bleiben.
  await Menus.updateMany(
    { restaurantID: RESTAURANT_ID, availableOrderTypes: { $exists: false }, category: { $in: [...DEFAULT_PICKUP_CATEGORIES] } },
    { $set: { availableOrderTypes: ["DINE_IN", "PICKUP"] } },
  );
  await Menus.updateMany(
    { restaurantID: RESTAURANT_ID, availableOrderTypes: { $exists: false } },
    { $set: { availableOrderTypes: ["DINE_IN"] } },
  );

  const menuDocuments = await Menus.find({ restaurantID: RESTAURANT_ID, hidden: false }).lean();
  const menuIds = menuDocuments.map((menu) => menu._id);

  await accounts.updateOne({ _id: account._id }, { $set: { menus: menuIds } });

  if (account.profile) {
    await profiles.updateOne(
      { _id: account.profile },
      {
        $set: { restaurantID: RESTAURANT_ID },
        $addToSet: { categories: { $each: [...categories] } },
      },
    );
  }

  console.log(`Account mit ${menuIds.length} Menüs verknüpft`);
  console.log("Menüsynchronisation abgeschlossen.");
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Menüsynchronisation fehlgeschlagen:");
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
