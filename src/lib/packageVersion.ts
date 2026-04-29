import * as fs from 'fs';
import * as path from 'path';

/**
 * Same version semantic-release writes into package.json before npm publish.
 */
function readPackageVersion(): string {
  let dir: string = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      if (
        pkg.name === 'snyk-request-manager' &&
        typeof pkg.version === 'string'
      ) {
        return pkg.version;
      }
    } catch {
      /* missing or unreadable */
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return '0.0.0';
}

export const PACKAGE_VERSION = readPackageVersion();
