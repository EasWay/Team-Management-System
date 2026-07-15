-- Manual, one-time cleanup script for team_members_collaborative rows
-- created by two now-fixed bugs (see git history around this file's
-- addition for the full writeup):
--
--   1. A startup migration block in server/db.ts that CROSS JOINed every
--      team against every user on every server restart.
--   2. automaticallyAssignTeams() in server/db.ts, called from
--      server/oauth-callbacks.ts on every OAuth login, which enrolled the
--      logging-in user into every existing team.
--
-- Both bugs share a detectable signature: they insert many rows in a
-- single SQL statement, so all rows in one batch share the exact same
-- `joined_at` timestamp (Postgres `now()` is constant within a statement).
-- A real individual join/invite/admin-add does not produce that clustering.
-- `role='developer'` alone is NOT a safe signal — several legitimate flows
-- (self-service join approval, admin-added members) also default to it.
--
-- This script is NOT run automatically by any migration tooling. Run it
-- manually, in this order, against your actual database:
--
--   1. Run the PREVIEW query below. Read through the output.
--   2. If it looks right (rows you don't recognize as real people who
--      intentionally joined those teams), uncomment and run the DELETE
--      at the bottom.
--   3. Consider taking a database backup/snapshot before running the
--      DELETE, since this is not reversible.

-- ============================================================
-- STEP 1: PREVIEW (read-only, safe to run anytime)
-- ============================================================
WITH bug1_candidates AS (
  -- Bug 1 signature: many different member_ids sharing (team_id, joined_at)
  SELECT tmc.*
  FROM team_members_collaborative tmc
  JOIN (
    SELECT team_id, joined_at
    FROM team_members_collaborative
    GROUP BY team_id, joined_at
    HAVING COUNT(*) > 1
  ) clusters ON tmc.team_id = clusters.team_id AND tmc.joined_at = clusters.joined_at
),
bug2_candidates AS (
  -- Bug 2 signature: many different team_ids sharing (member_id, joined_at)
  SELECT tmc.*
  FROM team_members_collaborative tmc
  JOIN (
    SELECT member_id, joined_at
    FROM team_members_collaborative
    GROUP BY member_id, joined_at
    HAVING COUNT(*) > 1
  ) clusters ON tmc.member_id = clusters.member_id AND tmc.joined_at = clusters.joined_at
),
candidates AS (
  SELECT * FROM bug1_candidates
  UNION
  SELECT * FROM bug2_candidates
)
SELECT
  c.id, c.team_id, t.name AS team_name, c.member_id, tm.name AS member_name,
  tm.email AS member_email, c.role, c.status, c.joined_at,
  -- Safety checks — TRUE means this row should almost certainly be KEPT,
  -- not deleted, even though it matched the clustering signature above.
  (t.created_by = c.member_id) AS is_team_creator,
  EXISTS (
    SELECT 1 FROM team_invitations ti
    WHERE ti.team_id = c.team_id AND ti.email = tm.email AND ti.status = 'accepted'
  ) AS has_matching_invitation
FROM candidates c
JOIN teams t ON t.id = c.team_id
JOIN team_members tm ON tm.id = c.member_id
ORDER BY c.joined_at, c.team_id, c.member_id;

-- ============================================================
-- STEP 2: DELETE (destructive — only run after reviewing STEP 1's output,
-- and only for rows where is_team_creator = false AND
-- has_matching_invitation = false). Commented out on purpose.
-- ============================================================

-- WITH bug1_candidates AS (
--   SELECT tmc.*
--   FROM team_members_collaborative tmc
--   JOIN (
--     SELECT team_id, joined_at
--     FROM team_members_collaborative
--     GROUP BY team_id, joined_at
--     HAVING COUNT(*) > 1
--   ) clusters ON tmc.team_id = clusters.team_id AND tmc.joined_at = clusters.joined_at
-- ),
-- bug2_candidates AS (
--   SELECT tmc.*
--   FROM team_members_collaborative tmc
--   JOIN (
--     SELECT member_id, joined_at
--     FROM team_members_collaborative
--     GROUP BY member_id, joined_at
--     HAVING COUNT(*) > 1
--   ) clusters ON tmc.member_id = clusters.member_id AND tmc.joined_at = clusters.joined_at
-- ),
-- candidates AS (
--   SELECT c.id
--   FROM (SELECT * FROM bug1_candidates UNION SELECT * FROM bug2_candidates) c
--   JOIN teams t ON t.id = c.team_id
--   JOIN team_members tm ON tm.id = c.member_id
--   WHERE t.created_by != c.member_id
--     AND NOT EXISTS (
--       SELECT 1 FROM team_invitations ti
--       WHERE ti.team_id = c.team_id AND ti.email = tm.email AND ti.status = 'accepted'
--     )
-- )
-- DELETE FROM team_members_collaborative
-- WHERE id IN (SELECT id FROM candidates);
