[<img alt="TypeScript: strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white&style=flat-square" height="20">](ts/architecture)
<img alt="module: ESM only" src="https://img.shields.io/badge/module-ESM_only-f7df1e?logo=javascript&logoColor=black&style=flat-square" height="20">
<img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white&style=flat-square" height="20">
<img alt="runtime deps: 0" src="https://img.shields.io/badge/runtime_deps-0-44cc11?style=flat-square" height="20">
<img alt="WebAssembly" src="https://img.shields.io/badge/WebAssembly-654FF0?logo=webassembly&logoColor=white" height="20">

EV-invest's shared libraries — a polyglot monorepo. Each library is opt-in, so a
consumer pulls in only what it asks for: a Cargo feature on the Rust side, a
package under `ts/` on the TypeScript side.
