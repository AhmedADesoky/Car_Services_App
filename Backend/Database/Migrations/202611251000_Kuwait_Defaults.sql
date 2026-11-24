-- 202611251000_Kuwait_Defaults.sql - launch market is Kuwait: Kuwaiti dinar (3 decimals, fils) and Kuwait time.

-- KWD has 1000 fils: money needs 3 decimals.
ALTER TABLE app.plans ALTER COLUMN price_monthly TYPE numeric(12,3);
ALTER TABLE app.plans ALTER COLUMN currency SET DEFAULT 'KWD';
UPDATE app.plans SET currency = 'KWD' WHERE currency = 'EGP';

ALTER TABLE app.tenants ALTER COLUMN currency SET DEFAULT 'KWD';
ALTER TABLE app.tenants ALTER COLUMN time_zone SET DEFAULT 'Asia/Kuwait';
-- existing development stations follow the launch market
UPDATE app.tenants SET currency = 'KWD' WHERE currency = 'EGP';
UPDATE app.tenants SET time_zone = 'Asia/Kuwait' WHERE time_zone = 'Africa/Cairo';
