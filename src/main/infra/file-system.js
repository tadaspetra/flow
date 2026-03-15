const fs = require('fs');
const path = require('path');

function ensureDirectory(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`Failed to delete file at ${filePath}:`, error);
  }
}

function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read JSON file at ${filePath}:`, error);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function isDirectoryEmpty(folderPath) {
  try {
    return fs.readdirSync(folderPath).length === 0;
  } catch {
    return false;
  }
}

module.exports = {
  fs,
  ensureDirectory,
  safeUnlink,
  readJsonFile,
  writeJsonFile,
  isDirectoryEmpty
};
