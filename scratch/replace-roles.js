const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (file.endsWith('prisma-enums.ts')) {
    if (!content.includes('SCHOOL_ADMIN')) {
      content = content.replace(/KARORDFORANDE = 'KARORDFORANDE',/g, "KARORDFORANDE = 'KARORDFORANDE',\n  SCHOOL_ADMIN = 'SCHOOL_ADMIN',");
    }
  } else {
    content = content.replace(/Role\.KARORDFORANDE(?!, Role\.SCHOOL_ADMIN)/g, 'Role.KARORDFORANDE, Role.SCHOOL_ADMIN');
    content = content.replace(/user\.role === 'KARORDFORANDE'/g, "['KARORDFORANDE', 'SCHOOL_ADMIN'].includes(user.role)");
    content = content.replace(/requestingUser\?\.role === 'KARORDFORANDE'/g, "['KARORDFORANDE', 'SCHOOL_ADMIN'].includes(requestingUser?.role)");
    content = content.replace(/\['TIKIT_ADMIN', 'KARORDFORANDE'\]/g, "['TIKIT_ADMIN', 'KARORDFORANDE', 'SCHOOL_ADMIN']");
    content = content.replace(/\['TIKIT_ADMIN', 'KARORDFORANDE', 'STUDENT'\]/g, "['TIKIT_ADMIN', 'KARORDFORANDE', 'SCHOOL_ADMIN', 'STUDENT']");
    content = content.replace(/role: 'KARORDFORANDE'/g, "role: 'SCHOOL_ADMIN'"); 
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
});
