import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true });
  const testsRoot = path.resolve(__dirname, '.');

  try {
    // Use the updated glob API syntax with async/await
    const files = await glob('**/*.test.js', { cwd: testsRoot });
    
    if (files.length === 0) return;
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    await new Promise<void>((res, rej) =>
      mocha.run(failures => (failures ? rej(new Error(`${failures} tests failed.`)) : res())),
    );
  } catch (err) {
    console.error('Error running tests:', err);
    throw err;
  }
}
