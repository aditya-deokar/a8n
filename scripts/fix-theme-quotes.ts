import fs from 'node:fs';
import path from 'node:path';

const THEME_CLASSES = "bg-[#f6f8fb] dark:bg-[#18181b] rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-xl";

const basePath = path.join(__dirname, '../src/components/ui');
const files = fs.readdirSync(basePath);

for (const file of files) {
  if (!file.endsWith('.tsx')) continue;
  
  const filePath = path.join(basePath, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // The string looks like: `some string" bg-[#f6f8fb] ... shadow-xl`
  // We want to replace `" bg-[#f6f8fb]` with ` bg-[#f6f8fb]` and append `"` after `shadow-xl`
  
  if (content.includes(`" ${THEME_CLASSES}`)) {
    content = content.replace(`" ${THEME_CLASSES}`, ` ${THEME_CLASSES}"`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed quotes in ${file}`);
  }
}
