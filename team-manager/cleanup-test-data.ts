import Database from 'better-sqlite3';

const db = new Database('./dev.db');

console.log('Starting cleanup of test data...');

// Count before cleanup
const departmentsBefore = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
const teamMembersBefore = db.prepare('SELECT COUNT(*) as count FROM teamMembers').get() as { count: number };

console.log(`\nBefore cleanup:`);
console.log(`- Departments: ${departmentsBefore.count}`);
console.log(`- Team Members: ${teamMembersBefore.count}`);

// Delete test departments (keep only real ones - those with meaningful names)
// Delete departments that look like test data (single characters, random strings, etc.)
db.prepare(`
  DELETE FROM departmentAssignments 
  WHERE departmentId IN (
    SELECT id FROM departments 
    WHERE length(name) <= 2 
    OR name LIKE '%_1769%'
    OR name LIKE '%test%'
    OR name LIKE '%Test%'
  )
`).run();

db.prepare(`
  DELETE FROM departments 
  WHERE length(name) <= 2 
  OR name LIKE '%_1769%'
  OR name LIKE '%test%'
  OR name LIKE '%Test%'
`).run();

// Delete test team members
db.prepare(`
  DELETE FROM teamMembers 
  WHERE (length(name) <= 2)
  OR name LIKE '%_1769%'
  OR position LIKE '%Oa__defineSe%'
  OR position LIKE '%|ynOpfkFNrX%'
  OR name LIKE '%7rElXKSE%'
  OR name LIKE '%!_%'
  OR name LIKE '%na_%'
  OR name LIKE '%a_%'
  OR name LIKE '%A_%'
  OR name LIKE '%1_%'
  OR name LIKE '%)_%'
  OR name LIKE '%#_%'
  OR name LIKE '%"_%'
  OR (position IN ('e', 'C', '2', ')', '%', '#', '"', '!', 'X', '<', '.', '''', '$'))
`).run();

// Count after cleanup
const departmentsAfter = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
const teamMembersAfter = db.prepare('SELECT COUNT(*) as count FROM teamMembers').get() as { count: number };

console.log(`\nAfter cleanup:`);
console.log(`- Departments: ${departmentsAfter.count}`);
console.log(`- Team Members: ${teamMembersAfter.count}`);

console.log(`\nDeleted:`);
console.log(`- Departments: ${departmentsBefore.count - departmentsAfter.count}`);
console.log(`- Team Members: ${teamMembersBefore.count - teamMembersAfter.count}`);

db.close();
console.log('\nCleanup complete!');
