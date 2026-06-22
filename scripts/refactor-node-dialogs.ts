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

const triggerFiles = findFiles(path.join(__dirname, '../src/features/triggers/components'), /dialog\.tsx$/);
const executionFiles = findFiles(path.join(__dirname, '../src/features/executions/components'), /dialog\.tsx$/);

const allFiles = [...triggerFiles, ...executionFiles];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes("NodeDialogContent")) {
    console.log(`Skipping ${file}, already refactored.`);
    continue;
  }

  // Remove DialogContent from the import
  content = content.replace(/\bDialogContent,\s*/g, '');
  
  // Add NodeDialogContent import
  const importStatement = `import { NodeDialogContent } from "@/components/node-dialog";\n`;
  
  // Find the last import to inject it safely, or just put it after the first import
  content = content.replace(/(import .* from ".*";\r?\n)/, `$1${importStatement}`);

  // Replace JSX tags
  content = content.replace(/<DialogContent(.*?)>/g, '<NodeDialogContent$1>');
  content = content.replace(/<\/DialogContent>/g, '</NodeDialogContent>');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Refactored ${file}`);
}
