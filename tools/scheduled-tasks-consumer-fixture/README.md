# scheduled-tasks-consumer-fixture

This isolated Vite host installs packed `@epam/ai-dial-scheduled-tasks` and
its workspace dependency closure. It has no source aliases: `src/main.tsx`
imports only the public root and `./styles.css` package entries.

Run the package-boundary build with:

```sh
npm exec nx run scheduled-tasks-consumer-fixture:build
```

The `pack-lib` target rebuilds the scheduler, rewrites each tarball using the
same publish transform as release tooling, and installs it into this fixture's
own `node_modules`.
