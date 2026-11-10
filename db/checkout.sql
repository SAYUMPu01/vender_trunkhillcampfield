CREATE TABLE IF NOT EXISTS checkout_settings (
  id INT PRIMARY KEY,
  electricity_rate INT UNSIGNED NOT NULL,
  free_units_per_guest INT UNSIGNED NOT NULL DEFAULT 1000,
  promptpay VARCHAR(13) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_checkouts (
  booking CHAR(20) PRIMARY KEY,
  units_milli INT UNSIGNED NOT NULL,
  electricity_rate INT UNSIGNED NULL,
  free_units_per_guest INT UNSIGNED NOT NULL DEFAULT 0,
  electricity_amount BIGINT UNSIGNED NOT NULL,
  damage_amount INT UNSIGNED NOT NULL,
  other_amount INT UNSIGNED NOT NULL,
  lodging_charges TEXT NULL,
  note VARCHAR(500) NOT NULL,
  promptpay VARCHAR(13) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  completed_at DATETIME NULL,
  FOREIGN KEY (booking) REFERENCES bookings(id)
) ENGINE=InnoDB;
