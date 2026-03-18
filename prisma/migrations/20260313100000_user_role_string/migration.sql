-- Change User.role from UserRole enum to plain text to support custom roles
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
