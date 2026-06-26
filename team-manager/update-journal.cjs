
const fs = require('fs');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json'));
journal.entries.push({
  idx: 17,
  version: '7',
  when: Date.now(),
  tag: '0017_fix_team_members_duplicates',
  breakpoints: true
});
fs.writeFileSync('drizzle/meta/_journal.json', JSON.stringify(journal, null, 2));

