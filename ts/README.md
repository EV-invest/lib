# ts

TypeScript libraries. One directory per package, each self-contained with its own
`package.json`:

```
ts/
├── <library-a>/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
└── <library-b>/
    └── …
```

`node_modules/`, `dist/`, and `*.tsbuildinfo` are git-ignored (appended to the
root `.gitignore` by the flake; see [`../README.md`](../README.md)).
