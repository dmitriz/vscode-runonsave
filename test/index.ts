import * as path from 'path';
import * as Mocha from 'mocha';
// Use require instead of import to avoid TypeScript type issues
const glob = require('glob');

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname, '.');

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true });
  const testsRoot = path.resolve(__dirname, '.');

  const files: string[] = await new Promise((res, rej) =>
    glob('**/*.test.js', { cwd: testsRoot }, (e, m) => (e ? rej(e) : res(m))),
  );
  if (files.length === 0) return;
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

  await new Promise<void>((res, rej) =>
    mocha.run(failures => (failures ? rej(new Error(`${failures} tests failed.`)) : res())),
  );
}
    } catch (err) {
      reject(err);
    }
  });
}
