import fs from 'fs-extra';
import path from 'path';

/**
 * Check if a file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read JSON file
 */
export async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
export async function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Get all files matching a pattern
 */
export async function findFiles(baseDir, pattern) {
  const files = [];
  
  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(baseDir);
  return files;
}