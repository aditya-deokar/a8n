import fs from 'node:fs';
import path from 'node:path';

const THEME_CLASSES = "bg-[#f6f8fb] dark:bg-[#18181b] rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-xl";

const updates = [
  {
    file: 'card.tsx',
    regex: /"bg-card text-card-foreground flex flex-col gap-[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-card', '').replace('border', '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  },
  {
    file: 'dialog.tsx',
    regex: /"bg-background data-\[state=open\]:animate-in data-\[state=closed\]:animate-out[^"]*"/g,
    replace: (match) => {
      // Remove bg-background, border, shadow-lg, rounded-lg
      return match.replace('bg-background', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  },
  {
    file: 'popover.tsx',
    regex: /"bg-popover text-popover-foreground data-\[state=open\]:animate-in data-\[state=closed\]:animate-out[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-popover', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  },
  {
    file: 'dropdown-menu.tsx',
    regex: /"bg-popover text-popover-foreground data-\[state=open\]:animate-in data-\[state=closed\]:animate-out[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-popover', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  },
  {
    file: 'sheet.tsx',
    regex: /"bg-background data-\[state=open\]:animate-in data-\[state=closed\]:animate-out[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-background', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES.replace('rounded-[1.5rem]', '')}`; // Sheets usually have their own rounding based on side
    }
  },
  {
    file: 'command.tsx',
    regex: /"bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-popover', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  },
  {
    file: 'alert-dialog.tsx',
    regex: /"bg-background data-\[state=open\]:animate-in data-\[state=closed\]:animate-out[^"]*"/g,
    replace: (match) => {
      return match.replace('bg-background', '').replace(/\bborder\b/, '').replace(/rounded-\w+/, '').replace(/shadow-\w+/, '') + ` ${THEME_CLASSES}`;
    }
  }
];

const basePath = path.join(__dirname, '../src/components/ui');

for (const update of updates) {
  const filePath = path.join(basePath, update.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Fallback if regex doesn't match perfectly
    content = content.replace(update.regex, update.replace);
    
    // For command.tsx, there's another DialogContent that uses different classes, wait command.tsx uses DialogContent from dialog.tsx!
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${update.file}`);
    } else {
      console.log(`Regex did not match for ${update.file}`);
      
      // Let's just do a generic replace for className={cn("...")} inside these components
      if (update.file === 'card.tsx') {
        content = content.replace(/"bg-card text-card-foreground flex flex-col gap-[^"]*"/, '"text-card-foreground flex flex-col gap-6 py-6 ' + THEME_CLASSES + '"');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Force updated ${update.file}`);
      }
      else if (update.file === 'command.tsx') {
        content = content.replace(/"bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden[^"]*"/, '"text-popover-foreground flex h-full w-full flex-col overflow-hidden ' + THEME_CLASSES + '"');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Force updated ${update.file}`);
      }
    }
  }
}
