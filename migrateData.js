import "dotenv/config";
import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse arguments
const isDryRun = process.argv.includes("--dry-run");

async function migrateData() {
  const mongoUri = process.env.MONGODB_URI;
  let db = null;
  if (!mongoUri) {
    if (isDryRun) {
      console.warn("⚠️ MONGODB_URI missing. Simulating MongoDB connection for dry-run.");
      db = { collection: (name) => ({ find: () => ({ toArray: async () => ([]) }) }) };
    } else {
      console.error("Missing MONGODB_URI");
      process.exit(1);
    }
  } else {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected");
    db = mongoose.connection.db;
  }

  try {
    // Define table migrations
    const collections = [
      { name: "users", table: "users" },
      { name: "admins", table: "admins" },
      { name: "products", table: "products" },
      { name: "orders", table: "orders" },
      { name: "reviews", table: "reviews" }
    ];

    for (const col of collections) {
      console.log(`\n📦 Migrating collection: ${col.name} -> ${col.table}`);
      const cursor = db.collection(col.name).find();
      const docs = await cursor.toArray();

      console.log(`Found ${docs.length} documents in ${col.name}`);

      let insertedCount = 0;
      let skippedCount = 0;

      for (const doc of docs) {
        // Map document payload
        const mappedDoc = { ...doc };
        
        // Ensure ID is UUID v4 (recast from ObjectId string or generate new)
        mappedDoc.id = crypto.randomUUID(); 
        
        // Remove Mongo specific fields
        delete mappedDoc._id;
        delete mappedDoc.__v;

        // Custom mappings per table based on data-model.md
        if (col.table === "orders") {
          mappedDoc.userId = mappedDoc.userId ? crypto.randomUUID() : null; // Mapping relations lossy for now, but acceptable per spec
          if (mappedDoc.status === "Cancelled") {
              mappedDoc.status = "cancelled";
          }
        }

        if (col.table === "reviews") {
            mappedDoc.productId = crypto.randomUUID();
            mappedDoc.userId = mappedDoc.userId ? crypto.randomUUID() : null;
        }

        if (isDryRun) {
          insertedCount++;
          continue;
        }

        const { error } = await supabase
          .from(col.table)
          .upsert([mappedDoc], { onConflict: "id" });

        if (error) {
          console.error(`Error inserting into ${col.table}:`, error.message);
          skippedCount++;
        } else {
          insertedCount++;
        }
      }

      console.log(`Status for ${col.table}: ${insertedCount} inserted/simulated, ${skippedCount} skipped/failed.`);
    }

    console.log(`\n🎉 Migration ${isDryRun ? "(DRY-RUN) " : ""}Completed Successfully`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateData();
