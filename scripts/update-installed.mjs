// 把 dist 里的新构建替换到 /Applications，并重新启动。
// 用法：npm run update-installed
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const NAME = '专注力训练营';
const SRC = path.resolve('dist/mac-arm64', NAME + '.app');
const DEST = '/Applications/' + NAME + '.app';

if (!fs.existsSync(SRC)) {
  console.error('找不到 ' + SRC + '，请先运行 npm run dist');
  process.exit(1);
}

// 1) 先退出正在运行的 App（没运行就忽略）
try { execSync(`osascript -e 'tell application "${NAME}" to quit'`, { stdio: 'ignore' }); } catch (e) {}
await new Promise(r => setTimeout(r, 1500));

// 2) 替换 /Applications 里的旧版本
try {
  fs.rmSync(DEST, { recursive: true, force: true });
  execSync(`ditto "${SRC}" "${DEST}"`);
} catch (e) {
  // 没有写权限时，退回用户级 Applications
  const fallback = path.join(process.env.HOME, 'Applications', NAME + '.app');
  console.error('无法写入 /Applications，改为安装到 ' + fallback);
  fs.mkdirSync(path.dirname(fallback), { recursive: true });
  fs.rmSync(fallback, { recursive: true, force: true });
  execSync(`ditto "${SRC}" "${fallback}"`);
  execSync(`open "${fallback}"`);
  process.exit(0);
}

// 3) 启动新版本
execSync(`open "${DEST}"`);
console.log('已更新并启动：' + DEST);
