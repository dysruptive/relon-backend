-- The init migration created a unique INDEX (not a constraint) on (role, permission).
-- The multi-tenancy migration tried to DROP CONSTRAINT, which silently no-ops on an index.
-- Both the old (role, permission) index and the new (organizationId, role, permission) index
-- exist simultaneously, causing unique violations when a second org saves role permissions.
-- Fix: drop the old index. The correct 3-field index already exists.

DROP INDEX IF EXISTS "role_permissions_role_permission_key";
