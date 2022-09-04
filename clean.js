const path = require("path");
const fs = require("fs").promises;
const fstat = require("fs").lstatSync;
const root = `node_modules`;

const REMOVED = Symbol(`removed item at path`);
const pruneDirs = [`deps`, `dist`, `test`, `docs`, `es5`];
const pruneFiles = [`.html`, `.map`, `.txt`, `.md`];

let dirCount = 0;
let fileCount = 0;

(async () => {
  async function clean(dir, handle) {
    const files = await fs.readdir(dir);
    for (let file of files) {
      const resolved = path.resolve(dir, file);
      const isDir = fstat(resolved).isDirectory();
      const result = await handle(resolved, isDir);
      if (isDir && result !== REMOVED) {
        await clean(resolved, handle);
      }
    }
  }

  async function handler(resource, isDir) {
    if (isDir) return handleDir(resource);
    return handleFile(resource);
  }

  async function handleDir(dir) {
    for (bad of pruneDirs) {
      const suffix = `${path.sep}${bad}`;
      if (dir.endsWith(suffix)) {
        await fs.rm(dir, { recursive: true, force: true });
        dirCount++;
        return REMOVED;
      }
    }
  }

  async function handleFile(file) {
    for (ext of pruneFiles) {
      if (file.endsWith(ext)) {
        await fs.unlink(file);
        fileCount++;
        return REMOVED;
      }
    }
  }

  await clean(root, handler);
  console.log(`removed ${dirCount} dirs and ${fileCount} files.`);
})();
