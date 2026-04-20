#### Serving static directory

[`$apis.static()`](https://pocketbase.io/jsvm/functions/_apis.static.html) serves static directory content from the specified directory path or `fs.FS` value.

Expects the route to have a `{path...}` wildcard parameter.

```js
// serves static files from a filesystem root
routerAdd("GET", "/{path...}", $apis.static($os.dirFS("/path/to/public"), false));

// or from a plain directory string
routerAdd("GET", "/assets/{path...}", $apis.static("/path/to/public", false));
```
