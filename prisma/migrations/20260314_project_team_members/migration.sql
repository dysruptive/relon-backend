-- Migrate existing designerId → project_assignments
INSERT INTO project_assignments (id, "organizationId", "projectId", "userId", role, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "organizationId",
  id,
  "designerId",
  'Designer',
  NOW(),
  NOW()
FROM projects
WHERE "designerId" IS NOT NULL
ON CONFLICT ("projectId", "userId") DO NOTHING;

-- Migrate existing qsId → project_assignments
INSERT INTO project_assignments (id, "organizationId", "projectId", "userId", role, "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "organizationId",
  id,
  "qsId",
  'QS',
  NOW(),
  NOW()
FROM projects
WHERE "qsId" IS NOT NULL
ON CONFLICT ("projectId", "userId") DO NOTHING;

-- Drop the old columns
ALTER TABLE projects DROP COLUMN IF EXISTS "designerId";
ALTER TABLE projects DROP COLUMN IF EXISTS "qsId";
