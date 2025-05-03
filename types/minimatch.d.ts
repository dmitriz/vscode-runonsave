// Fix for type errors with glob and minimatch
declare module "minimatch" {
  interface IOptions {}
  interface IMinimatch {}
}
