require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
const ACCOUNT_TOKEN = process.env.READY2ORDER_ACCOUNT_TOKEN;
const RESTAURANT_ID = process.env.RESTAURANT_ID || "qrorder";
const API_BASE =
  process.env.READY2ORDER_API_BASE ||
  "https://api.ready2order.com/v1";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI missing");
}

if (!ACCOUNT_TOKEN) {
  throw new Error("READY2ORDER_ACCOUNT_TOKEN missing");
}

const readyProductSchema = new mongoose.Schema(
  {
    restaurantID: {
      type: String,
      required: true,
      index: true,
    },

    ready2orderProductId: {
      type: Number,
      required: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    sourceUpdatedAt: {
      type: Date,
      default: null,
    },

    syncedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "ready_products",
  }
);

readyProductSchema.index(
  {
    restaurantID: 1,
    ready2orderProductId: 1,
  },
  {
    unique: true,
  }
);

const ReadyProducts =
  mongoose.models.ReadyProducts ||
  mongoose.model("ReadyProducts", readyProductSchema);

async function ready2orderRequest(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${ACCOUNT_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `ready2order API error ${response.status}: ${body}`
    );
  }

  return response.json();
}

async function fetchAllProducts() {
  const limit = 250;
  let page = 1;
  const products = [];

  while (true) {
    const query = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      includeProductGroup: "true",
      includeProductVariations: "true",
    });

    console.log(`Lade Produktseite ${page} ...`);

    const result = await ready2orderRequest(
      `/products?${query.toString()}`
    );

    if (!Array.isArray(result)) {
      throw new Error(
        `Unexpected products response: ${JSON.stringify(result).slice(0, 500)}`
      );
    }

    console.log(`Seite ${page}: ${result.length} Produkte`);

    products.push(...result);

    if (result.length < limit) {
      break;
    }

    page += 1;
  }

  return products;
}


function parseReadyDate(value) {
  if (!value) return null;

  // ready2order liefert z. B. "2026-03-07 15:55:51"
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function syncProducts() {
  await mongoose.connect(MONGODB_URI);

  console.log("MongoDB:", mongoose.connection.name);
  console.log("Restaurant:", RESTAURANT_ID);

  const products = await fetchAllProducts();

  console.log(`Produkte von ready2order erhalten: ${products.length}`);

  const syncTime = new Date();
  const receivedProductIds = [];

  const operations = products.map((product) => {
    if (product.product_id === undefined || product.product_id === null) {
      throw new Error(
        `Product without product_id: ${JSON.stringify(product)}`
      );
    }

    receivedProductIds.push(product.product_id);

    return {
      updateOne: {
        filter: {
          restaurantID: RESTAURANT_ID,
          ready2orderProductId: product.product_id,
        },

        update: {
          $set: {
            restaurantID: RESTAURANT_ID,
            ready2orderProductId: product.product_id,

            // Vollständige, unveränderte API-Antwort
            data: product,

            sourceUpdatedAt: parseReadyDate(
              product.product_updated_at
            ),

            syncedAt: syncTime,
          },
        },

        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    const result = await ReadyProducts.bulkWrite(operations, {
      ordered: false,
    });

    console.log("Neu angelegt:", result.upsertedCount);
    console.log("Aktualisiert:", result.modifiedCount);
    console.log("Gefunden:", result.matchedCount);
  }

  /*
   * Alles löschen, was ready2order beim aktuellen vollständigen Abruf
   * nicht mehr zurückgegeben hat.
   *
   * Wichtig: Das ist nur sicher, wenn fetchAllProducts wirklich alle
   * Seiten erfolgreich geladen hat. Bei einem API-Fehler wird vorher
   * abgebrochen und hier nichts gelöscht.
   */
  const deleteResult = await ReadyProducts.deleteMany({
    restaurantID: RESTAURANT_ID,
    ready2orderProductId: {
      $nin: receivedProductIds,
    },
  });

  console.log("Nicht mehr vorhandene Produkte gelöscht:", deleteResult.deletedCount);

  const storedCount = await ReadyProducts.countDocuments({
    restaurantID: RESTAURANT_ID,
  });

  console.log("Aktueller Mongo-Bestand:", storedCount);
}

syncProducts()
  .then(async () => {
    console.log("Produktsynchronisation abgeschlossen.");
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Produktsynchronisation fehlgeschlagen:");
    console.error(error);

    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });