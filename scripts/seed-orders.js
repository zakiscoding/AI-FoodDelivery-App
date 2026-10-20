/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function hashPassword(password) {
  // Must match app/api/auth (bcrypt). Legacy SHA-256 hashes are still accepted at login.
  return bcrypt.hashSync(password, 12);
}

const projectRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(projectRoot, ".env.local"));
loadEnvFile(path.join(projectRoot, ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureTestUserAndProfile(role, email, name) {
  const { data: existingUser, error: findUserError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (findUserError) throw findUserError;

  let userId = existingUser?.id;

  if (!userId) {
    const { data: createdUser, error: createUserError } = await supabase
      .from("users")
      .insert({
        email,
        password_hash: hashPassword("password123"),
        name,
        role,
      })
      .select("id")
      .single();

    if (createUserError) throw createUserError;
    userId = createdUser.id;
  }

  if (role === "customer") {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;

    if (existingProfile?.id) return existingProfile.id;

    const { data: createdProfile, error: createProfileError } = await supabase
      .from("customers")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (createProfileError) throw createProfileError;
    return createdProfile.id;
  }

  const { data: existingDriver, error: existingDriverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingDriverError) throw existingDriverError;

  if (existingDriver?.id) return existingDriver.id;

  const { data: createdDriver, error: createDriverError } = await supabase
    .from("drivers")
    .insert({ user_id: userId, status: "available" })
    .select("id")
    .single();

  if (createDriverError) throw createDriverError;
  return createdDriver.id;
}

async function seedOrders() {
  try {
    console.log("Seeding test orders...");

    const { data: restaurants, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, delivery_fee")
      .limit(6);

    if (restaurantError) throw restaurantError;

    if (!restaurants || restaurants.length === 0) {
      console.error("No restaurants found. Run `npm run seed` first.");
      process.exit(1);
    }

    const customerId = await ensureTestUserAndProfile(
      "customer",
      "dummy.customer@quickbite.test",
      "Dummy Customer"
    );

    await ensureTestUserAndProfile(
      "driver",
      "dummy.driver@quickbite.test",
      "Dummy Driver"
    );

    const sampleAddresses = [
      "120 King St, San Francisco, CA",
      "45 Market St, San Francisco, CA",
      "88 Mission St, San Francisco, CA",
      "10 Howard St, San Francisco, CA",
      "500 Castro St, Mountain View, CA",
      "1 Infinite Loop, Cupertino, CA",
    ];

    const sampleItems = [
      [{ name: "Classic Burger", qty: 1 }, { name: "Fries", qty: 1 }],
      [{ name: "Pad Thai", qty: 1 }, { name: "Spring Rolls", qty: 2 }],
      [{ name: "Margherita Pizza", qty: 1 }],
      [{ name: "California Roll", qty: 2 }],
      [{ name: "Butter Chicken", qty: 1 }, { name: "Naan", qty: 2 }],
      [{ name: "Burrito", qty: 1 }, { name: "Quesadilla", qty: 1 }],
    ];

    const ordersToInsert = restaurants.map((restaurant, idx) => {
      const items = sampleItems[idx % sampleItems.length];
      const subtotal = items.reduce((sum, item) => sum + (item.qty || 1) * 12.5, 0);
      const deliveryFee = Number(restaurant.delivery_fee ?? 3.99);

      return {
        customer_id: customerId,
        restaurant_id: String(restaurant.id),
        items,
        total_price: Number((subtotal + deliveryFee).toFixed(2)),
        delivery_fee: deliveryFee,
        status: "pending",
        delivery_address: sampleAddresses[idx % sampleAddresses.length],
      };
    });

    const { data: insertedOrders, error: insertError } = await supabase
      .from("orders")
      .insert(ordersToInsert)
      .select("id, status, created_at");

    if (insertError) throw insertError;

    console.log(`Inserted ${insertedOrders?.length || 0} pending orders.`);
    console.log("Test login credentials:");
    console.log("  Driver   -> dummy.driver@quickbite.test / password123");
    console.log("  Customer -> dummy.customer@quickbite.test / password123");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed orders:", error);
    process.exit(1);
  }
}

seedOrders();
