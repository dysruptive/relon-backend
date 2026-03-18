-- Add currentPeriodEnd for end-of-period access after cancellation
-- Add pastDueSince for 7-day grace period tracking
ALTER TABLE "organizations"
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "pastDueSince" TIMESTAMP(3);
