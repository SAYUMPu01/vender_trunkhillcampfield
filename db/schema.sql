CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY,
  mode ENUM('person','plot') NOT NULL,
  person_price INT UNSIGNED NOT NULL,
  minimum_per_plot INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory (
  code VARCHAR(24) PRIMARY KEY,
  kind ENUM('plot','room','gear') NOT NULL,
  zone VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  detail VARCHAR(240) NOT NULL,
  price INT UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  INDEX inventory_kind_code (kind, code),
  INDEX inventory_kind_zone_code (kind, zone, code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(20) PRIMARY KEY,
  request_key CHAR(36) NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  guest VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  arrival DATE NOT NULL,
  departure DATE NOT NULL,
  adults INT UNSIGNED NOT NULL,
  children INT UNSIGNED NOT NULL,
  seniors INT UNSIGNED NOT NULL,
  total INT UNSIGNED NOT NULL,
  status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  reschedule_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX bookings_created (created_at),
  INDEX bookings_status_created (status, created_at, id),
  INDEX bookings_phone (phone),
  INDEX bookings_guest (guest)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_photos (
  code VARCHAR(24) PRIMARY KEY,
  mime VARCHAR(32) NOT NULL,
  photo MEDIUMBLOB NOT NULL,
  FOREIGN KEY (code) REFERENCES inventory(code) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plot_map_positions (
  code VARCHAR(24) PRIMARY KEY,
  x DECIMAL(5,2) UNSIGNED NOT NULL,
  y DECIMAL(5,2) UNSIGNED NOT NULL,
  shape_json TEXT NULL,
  FOREIGN KEY (code) REFERENCES inventory(code) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plot_map_background (
  id INT PRIMARY KEY,
  revision CHAR(36) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  content MEDIUMBLOB NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_lines (
  booking CHAR(20) NOT NULL,
  code VARCHAR(24) NOT NULL,
  name VARCHAR(120) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  PRIMARY KEY (booking, code),
  FOREIGN KEY (booking) REFERENCES bookings(id),
  FOREIGN KEY (code) REFERENCES inventory(code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_config (
  id INT PRIMARY KEY,
  recipient VARCHAR(120) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  qr MEDIUMBLOB NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS zone_details (
  zone VARCHAR(12) PRIMARY KEY,
  description TEXT NOT NULL,
  rules TEXT NOT NULL,
  gallery_caption TEXT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO zone_details (zone, description, rules) VALUES
('A','ลานฝั่งขวา ชมวิวภูเขาด้านหน้าและด้านข้าง ใกล้ห้องน้ำและจุดล้างจาน',''),
('B','',''),('C','',''),('D','',''),('BOX','','');

CREATE TABLE IF NOT EXISTS zone_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone VARCHAR(12) NOT NULL,
  kind ENUM('image','video') NOT NULL,
  mime VARCHAR(32) NOT NULL,
  caption VARCHAR(120) NOT NULL,
  content MEDIUMBLOB NOT NULL,
  INDEX zone_media_zone_kind (zone,kind,id),
  FOREIGN KEY (zone) REFERENCES zone_details(zone) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_payments (
  booking CHAR(20) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  mime VARCHAR(32) NULL,
  slip MEDIUMBLOB NULL,
  FOREIGN KEY (booking) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS allocations (
  code VARCHAR(24) NOT NULL,
  night DATE NOT NULL,
  booking CHAR(20) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (code, night, booking),
  INDEX allocations_booking (booking),
  FOREIGN KEY (booking, code) REFERENCES booking_lines(booking, code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_rentals (
  booking CHAR(20) NOT NULL,
  host VARCHAR(24) NOT NULL,
  code VARCHAR(24) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (booking, host, code),
  FOREIGN KEY (booking) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO settings VALUES (1,'person',150,2);
INSERT IGNORE INTO inventory (code,kind,zone,name,detail,price,stock,active) VALUES
('A01','plot','A','A01','10 × 10 เมตร',500,1,1),
('A02','plot','A','A02','10 × 10 เมตร',500,1,1),
('A03','plot','A','A03','10 × 10 เมตร',500,1,1),
('A04','plot','A','A04','10 × 10 เมตร',500,1,1),
('A05','plot','A','A05','10 × 10 เมตร',500,1,1),
('A06','plot','A','A06','10 × 10 เมตร',500,1,1),
('A07','plot','A','A07','10 × 10 เมตร',500,1,1),
('A08','plot','A','A08','10 × 10 เมตร',500,1,1),
('A09','plot','A','A09','10 × 10 เมตร',500,1,1),
('A10','plot','A','A10','10 × 10 เมตร',500,1,1),
('SNOW-PEAK','gear','GEAR','Snow Peak','จำนวนสำหรับทดสอบ',600,3,1);

-- Sample stock for the rental selection in the local booking flow.
INSERT IGNORE INTO inventory (code,kind,zone,name,detail,price,stock,active) VALUES
('LANDNEST-DOME','gear','GEAR','Snow Peak Landnest Dome M','เต็นท์',700,3,1),
('VAULT-TARP','gear','GEAR','Snow Peak Vault + Tarp','เต็นท์พร้อมทาร์ป',900,3,1),
('LANDNEST-SHELTER','gear','GEAR','Snow Peak Landnest Shelter','เต็นท์',900,3,1),
('LANDLOCK','gear','GEAR','Snow Peak Landlock Red Frame','เต็นท์',1000,3,1),
('SNOW-PEAK-TARP','gear','GEAR','Snow Peak Tarp + LED','ทาร์ปพร้อมไฟ LED 1 ดวง',300,3,1),
('TRUNKBOX','room','BOX','Trunkbox','บ้านพัก',1500,1,1),
('BEDDING','gear','GEAR','ชุดที่นอนพร้อมหมอน','ชุด',100,3,1),
('SLEEPING-BAG','gear','GEAR','ถุงนอน Snow Peak','ผืน',100,3,1),
('CAMP-TABLE','gear','GEAR','โต๊ะ Camping','ตัว',100,3,1),
('CAMP-CHAIR','gear','GEAR','เก้าอี้ Snow Peak','ตัว',100,3,1),
('EXTENSION','gear','GEAR','ปลั๊กพ่วง','เส้น',50,3,1),
('LED-LIGHT','gear','GEAR','ไฟ LED','ดวง',50,3,1),
('FAN','gear','GEAR','พัดลม','ตัว',50,3,1),
('AIR-CONDITIONER','gear','GEAR','แอร์','ตัว',150,3,1);
