import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

const regex = /export async function removeTeamMember\([\s\S]*?return true;\s*\}\);\s*\}/;

const replacement = `export async function removeTeamMember(
    teamId: number,
    targetMemberId: number,
    removedBy: number
  ): Promise<boolean> {
    let shouldDeleteCompletely = false;
    
    await withTransaction(async (db) => {
      // Check remover has permission
      const [removerMembership] = await db
        .select()
        .from(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, teamId),
            eq(teamMembersCollaborative.memberId, removedBy)
          )
        )
        .limit(1);
  
      if (!removerMembership || !hasPermission(removerMembership.role as TeamRole, 'remove_member')) {
        throw new ValidationError('Insufficient permissions to remove member');
      }
  
      // Cannot remove team creator
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
  
      if (team && team.createdBy === targetMemberId) {
        throw new ValidationError('Cannot remove team creator');
      }
  
      // Remove member
      await db
        .delete(teamMembersCollaborative)
        .where(
          and(
            eq(teamMembersCollaborative.teamId, teamId),
            eq(teamMembersCollaborative.memberId, targetMemberId)
          )
        );
        
      // Check if they have any other team memberships
      const remaining = await db
        .select({ id: teamMembersCollaborative.id })
        .from(teamMembersCollaborative)
        .where(eq(teamMembersCollaborative.memberId, targetMemberId))
        .limit(1);
        
      if (remaining.length === 0) {
        shouldDeleteCompletely = true;
      }
  
      return true;
    });
    
    if (shouldDeleteCompletely) {
      await permanentlyDeleteUser(targetMemberId);
    }
    
    return true;
  }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(dbPath, content, 'utf8');
  console.log('Successfully patched db.ts');
} else {
  console.log('Target regex not found in db.ts');
}
