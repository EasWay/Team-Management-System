
const fs = require('fs');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json'));
journal.entries.push({
  idx: 18,
  version: '7',
  when: Date.now(),
  tag: '0018_create_user_push_tokens',
  breakpoints: true
});
fs.writeFileSync('drizzle/meta/_journal.json', JSON.stringify(journal, null, 2));

