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

  return new Promise((resolve, reject) => {
    try {
      export async function run(): Promise<void> {
        // Create the mocha test
        const mocha = new Mocha({
          ui: 'tdd',
          color: true
        });

        const testsRoot = path.resolve(__dirname, '.');

        try {
          // Use asynchronous glob to find test files using the conventional pattern
          const files: string[] = await new Promise((resolve, reject) => {
            glob('**/*.test.js', { cwd: testsRoot }, (err: Error, matches: string[]) => {
              return err ? reject(err) : resolve(matches);
            });
          });

          // If no test files found, resolve immediately
          if (!files.length) {
            return;
          }

          // Add files to the test suite
          files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

          // Run the mocha tests
          await new Promise<void>((resolve, reject) => {
            mocha.run(failures => {
              if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
              } else {
                resolve();
              }
            });
          });
        } catch (err) {
          return Promise.reject(err);
        }
      }
    } catch (err) {
      reject(err);
    }
  });
}
