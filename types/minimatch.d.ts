// Fix for type errors with glob and minimatch
declare module "minimatch" {
  // Interface representing options for the minimatch library.
  // Add specific properties as needed, e.g., `nocase?: boolean;` for case-insensitive matching.
  interface IOptions {
    // Example property: case-insensitive matching
    nocase?: boolean;
  }

  // Interface representing a minimatch instance.
  // Add specific properties or methods as needed, e.g., `match(input: string): boolean;`.
  interface IMinimatch {
    // Example method: match a string against the pattern
    match(input: string): boolean;
  }
}
