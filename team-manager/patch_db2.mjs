import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

const regex = /if \(fallbackAdminId\) \{[\s\S]*?\} else \{[\s\S]*?\}/;

const replacement = `      const runSafe = async (query: any) => {
        try {
          await tx.execute(sql\`SAVEPOINT update_sp\`);
          await tx.execute(query);
          await tx.execute(sql\`RELEASE SAVEPOINT update_sp\`);
        } catch (err) {
          await tx.execute(sql\`ROLLBACK TO SAVEPOINT update_sp\`);
        }
      };

      if (fallbackAdminId) {
        await runSafe(sql\`UPDATE file_folders SET created_by = \${fallbackAdminId} WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE calendar_events SET created_by = \${fallbackAdminId} WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE video_calls SET host_id = \${fallbackAdminId} WHERE host_id = \${targetUserId}\`);
        await runSafe(sql\`UPDATE resource_permissions SET granted_by = \${fallbackAdminId} WHERE granted_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE office_access_control SET granted_by = \${fallbackAdminId} WHERE granted_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE ip_whitelist SET added_by = \${fallbackAdminId} WHERE added_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE permission_roles SET created_by = \${fallbackAdminId} WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE user_role_assignments SET assigned_by = \${fallbackAdminId} WHERE assigned_by = \${targetUserId}\`);
        await runSafe(sql\`UPDATE google_drive_connections SET connected_by = \${fallbackAdminId} WHERE connected_by = \${targetUserId}\`);
      } else {
        // Very rare fallback if no other admin exists: just delete to avoid constraint failures
        await runSafe(sql\`DELETE FROM file_folders WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM calendar_events WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM video_calls WHERE host_id = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM resource_permissions WHERE granted_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM office_access_control WHERE granted_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM ip_whitelist WHERE added_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM permission_roles WHERE created_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM user_role_assignments WHERE assigned_by = \${targetUserId}\`);
        await runSafe(sql\`DELETE FROM google_drive_connections WHERE connected_by = \${targetUserId}\`);
      }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(dbPath, content, 'utf8');
  console.log('Successfully patched db.ts');
} else {
  console.log('Target regex not found in db.ts');
}
