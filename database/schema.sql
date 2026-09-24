CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    profile_image TEXT,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    device_code VARCHAR(20) UNIQUE NOT NULL,

    device_name VARCHAR(100) NOT NULL,

    firmware_version VARCHAR(20),

    location VARCHAR(100),

    wifi_ssid VARCHAR(100),

    status VARCHAR(20) DEFAULT 'offline',

    last_seen TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_device_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE TABLE meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    device_id UUID NOT NULL,

    voltage NUMERIC(6,2) NOT NULL CHECK (voltage >= 0),

    current NUMERIC(8,3) NOT NULL CHECK (current >= 0),

    power NUMERIC(10,2) NOT NULL CHECK (power >= 0),

    energy NUMERIC(12,3) NOT NULL CHECK (energy >= 0),

    frequency NUMERIC(5,2) NOT NULL CHECK (frequency >= 0),

    power_factor NUMERIC(4,2) NOT NULL CHECK (power_factor >= 0 AND power_factor <= 1),

    recorded_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_meter_device
        FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_meter_device
ON meter_readings(device_id);

CREATE INDEX idx_meter_recorded_at
ON meter_readings(recorded_at);