import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Copy index.html
copyFile(
  path.join(root, 'src', 'index.html'),
  path.join(root, 'dist', 'index.html')
);

// Copy audio-processor if it's still a .js file (before conversion)
const audioSrc = path.join(root, 'src', 'audio-processor.js');
if (fs.existsSync(audioSrc)) {
  copyFile(audioSrc, path.join(root, 'dist', 'audio-processor.js'));
}

// Ensure renderer styles directory exists for Tailwind output
fs.mkdirSync(path.join(root, 'dist', 'renderer', 'styles'), { recursive: true });

console.log('Assets copied to dist/');
