#### Bundling hooks for deployment

In development, hooks can import local files, workspace packages, npm packages, and JSON as long as Bun can resolve them from the hook file location. For smaller deploy artifacts, you can bundle hooks before copying them so statically imported dependencies are included in generated hook files.

Use the CLI build command:

```sh
pocketbun hooks build --hooksDir pb_hooks --outDir dist/pb_hooks
```

Then copy `dist/pb_hooks` with the rest of your deploy artifact and run PocketBun with `--hooksDir dist/pb_hooks`.

Code-first apps can bundle before loading hooks:

```js
await registerServerJSAsync(app, {
  hooksDir: "pb_hooks",
  bundledHooksDir: "dist/pb_hooks",
  bundleHooks: true,
});
```

Hook bundling uses Bun's bundler with packages bundled and environment variable inlining disabled. Files such as `secrets.json` are included only when they are explicitly imported by hook code. Dynamic `import(...)` or `require(...)` expressions that Bun cannot resolve statically fail the build; move those dependencies to static imports or include them through your deploy packaging.
