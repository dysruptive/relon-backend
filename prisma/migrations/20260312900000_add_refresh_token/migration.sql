-- Add refresh token hash storage to users for rotation-based refresh token auth
ALTER TABLE "users" ADD COLUMN "refreshTokenHash" TEXT;
