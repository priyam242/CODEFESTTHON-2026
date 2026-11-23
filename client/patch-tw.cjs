const fs = require('fs');
const path = require('path');

try {
  const file = path.join(__dirname, 'node_modules/@tailwindcss/vite/dist/index.mjs');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const target = 'for(let n of this.scanner.scan())this.candidates.add(n);';
    const marker = '/* TW_WIN_SCANNER_FALLBACK */';
    if (content.includes(target) && !content.includes(marker)) {
      const replacement = `for(let n of this.scanner.scan())this.candidates.add(n); ${marker}
try {
  const fsSync = await import('fs');
  const pathSync = await import('path');
  const scanFolder = (dir) => {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = pathSync.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          scanFolder(full);
        }
      } else if (/\\.(html|jsx?|tsx?)$/.test(entry.name)) {
        const text = fsSync.readFileSync(full, 'utf8');
        const ext = pathSync.extname(entry.name).slice(1);
        const list = this.scanner.getCandidatesWithPositions({ content: text, extension: ext });
        for (const item of list) this.candidates.add(item.candidate);
      }
    }
  };
  scanFolder(this.base);
} catch (e) {}`;
      content = content.replace(target, replacement);
      fs.writeFileSync(file, content, 'utf8');
    }
  }
} catch (e) {}
