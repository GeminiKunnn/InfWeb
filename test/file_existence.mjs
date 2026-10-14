import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const dirs = pkg['h5bp-configs'].directories;

// Vue 3 + Vite 构建产物结构（由 npm run build:vite 生成）
// index.html 引用 ./assets/index-*.js / ./assets/index-*.css；content/** 由 vite 复制插件复制。
const expectedFilesInDistDir = [
  'index.html',
  'assets/',
  'content/',
  'content/updates/',
  'content/updates/changelog.json',
  'content/rules/',
];

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function checkFiles(directory, expectedFiles) {
  const files = globSync('**/*', {
    cwd: directory,
    dot: true,
    mark: true,
    posix: true,
  });

  expectedFiles.forEach((file) => {
    const expectedFileType =
      file.slice(-1) !== '/' ? 'regular file' : 'directory';
    let ok = files.indexOf(file) !== -1;
    if (ok && file.slice(-1) !== '/') {
      ok = fs.statSync(path.resolve(directory, file)).isFile();
    }
    it(`[dist] "${file}" 应存在且为 ${expectedFileType}`, () => {
      assert.equal(true, ok);
    });
  });

  it('[dist] index.html 引用构建出的 assets/js 与 css', () => {
    const html = fs.readFileSync(path.resolve(directory, 'index.html'), 'utf8');
    assert.match(html, /assets\/index-[\w-]+\.js/);
    assert.match(html, /assets\/index-[\w-]+\.css/);
  });
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function runTests() {
  const distAssets = path.join(dirs.dist, 'assets');
  if (!fs.existsSync(distAssets)) {
    // 未先跑 npm run build:vite 时，不校验产物结构（避免 `npm test` 依赖构建顺序）。
    describe('Vite 构建产物结构（dist/）', () => {
      it.skip('[dist] 需先运行 npm run build:vite 生成本校验目标（跳过）', () => {});
    });
    return;
  }
  describe('Vite 构建产物结构（dist/）', () => {
    checkFiles(dirs.dist, expectedFilesInDistDir);
  });
}

runTests();