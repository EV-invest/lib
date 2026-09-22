// `process.env.NODE_ENV` has to be spelled with a dot: that literal is what a
// consumer's bundler replaces, and the bracket form `noPropertyAccessFromIndexSignature`
// would demand is left alone and then throws in a browser. A declaration file,
// so it types this package's source without reaching the shipped `.d.ts`.
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
  }
}
