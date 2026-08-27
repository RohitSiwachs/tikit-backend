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
    // Remove KARORDFORANDE from enum
    content = content.replace(/KARORDFORANDE = 'KARORDFORANDE',\s*/g, '');
  } else {
    // Replace the combined roles back to just SCHOOL_ADMIN
    content = content.replace(/Role\.KARORDFORANDE,\s*Role\.SCHOOL_ADMIN/g, 'Role.SCHOOL_ADMIN');
    
    // In arrays or strings
    content = content.replace(/\['KARORDFORANDE',\s*'SCHOOL_ADMIN'\]\.includes\(user\.role\)/g, "user.role === 'SCHOOL_ADMIN'");
    content = content.replace(/\['KARORDFORANDE',\s*'SCHOOL_ADMIN'\]\.includes\(requestingUser\?\.role\)/g, "requestingUser?.role === 'SCHOOL_ADMIN'");
    
    // In exact arrays
    content = content.replace(/\['TIKIT_ADMIN',\s*'KARORDFORANDE',\s*'SCHOOL_ADMIN'\]/g, "['TIKIT_ADMIN', 'SCHOOL_ADMIN']");
    content = content.replace(/\['TIKIT_ADMIN',\s*'KARORDFORANDE',\s*'SCHOOL_ADMIN',\s*'STUDENT'\]/g, "['TIKIT_ADMIN', 'SCHOOL_ADMIN', 'STUDENT']");
    
    // Any remaining stray KARORDFORANDE text (like comments)
    content = content.replace(/KARORDFORANDE/g, 'SCHOOL_ADMIN');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
});
