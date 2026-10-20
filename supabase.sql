-- Run this in your Supabase SQL Editor to create the required tables

-- IMPORTANT: Drop old tables first if they exist from previous schema
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS order_messages CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  vehicle_info TEXT,
  license_number TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  rating DECIMAL(3, 2) DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  eta TEXT NOT NULL,
  image TEXT,
  owner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Backward-compatible migration for existing databases that predate geolocation fields.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website TEXT;

-- Create menus table
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Create orders table (updated)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  driver_id UUID,
  restaurant_id UUID NOT NULL,
  items JSONB NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  eta TEXT,
  tip DECIMAL(10, 2) NOT NULL DEFAULT 0,
  dropoff_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'arrived_at_restaurant', 'picked_up', 'arrived_at_customer', 'in_transit', 'delivered', 'cancelled')),
  delivery_address TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Backward-compatible migrations for databases created before new order fields existed.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_instructions TEXT;

-- Backward-compatible migration: replace the status CHECK constraint to include
-- new driver delivery statuses (arrived_at_restaurant, picked_up, arrived_at_customer).
-- The constraint is dropped by scanning pg_constraint so it works regardless of its
-- auto-generated name on older schemas, then re-added with a stable explicit name.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'orders'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'arrived_at_restaurant', 'picked_up', 'arrived_at_customer', 'in_transit', 'delivered', 'cancelled'));

-- Create restaurant cache table to store fetched restaurants by city/location
CREATE TABLE IF NOT EXISTS restaurant_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  restaurants JSONB NOT NULL DEFAULT '[]'::jsonb,
  cache_radius_km INTEGER DEFAULT 25,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for cache lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_city ON restaurant_cache(city);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_location ON restaurant_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_restaurant_cache_expires ON restaurant_cache(expires_at);

-- Create order messages table for direct customer-driver chat
CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  sender_user_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'driver')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create carts table (updated to use customer_id)
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  restaurant_id UUID NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_menus_restaurant_id ON menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_user_id ON order_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for demo - adjust for production)
CREATE POLICY "Allow users to read their own profile" ON users
  FOR SELECT USING (true);

CREATE POLICY "Allow users to insert" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update their own profile" ON users
  FOR UPDATE USING (true);

CREATE POLICY "Allow customers insert" ON customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow customers read" ON customers
  FOR SELECT USING (true);

CREATE POLICY "Allow drivers insert" ON drivers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow drivers read" ON drivers
  FOR SELECT USING (true);

CREATE POLICY "Allow drivers update" ON drivers
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read access to restaurants" ON restaurants
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to menus" ON menus
  FOR SELECT USING (true);

CREATE POLICY "Allow customers to read their own orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Allow customers to create orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow drivers to read assigned orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Allow drivers to update order status" ON orders
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow order participants to read messages" ON order_messages
  FOR SELECT USING (true);

CREATE POLICY "Allow order participants to create messages" ON order_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow customers to manage their own cart" ON carts
  FOR ALL USING (true);
