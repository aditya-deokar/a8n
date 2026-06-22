import fs from 'node:fs';
import path from 'node:path';

function findFiles(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, pattern));
    } else if (pattern.test(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}

const files = findFiles(path.join(__dirname, '../src/features/executions/components'), /\.ts$/);

const regex = /Handlebars\.registerHelper\("json",\s*\(context\)\s*=>\s*\{\s*const\s+jsonString\s*=\s*JSON\.stringify\(context,\s*null,\s*2\);\s*const\s+safeString\s*=\s*new\s+Handlebars\.SafeString\(jsonString\);\s*return\s+safeString;\s*\}\);/g;

const replacementBlock = `Handlebars.registerHelper("json", (context) => {
  if (context === undefined) {
    return new Handlebars.SafeString("null");
  }
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});`;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (regex.test(content)) {
    const updated = content.replace(regex, replacementBlock);
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`Updated Handlebars helper using regex in ${file}`);
  }
}
