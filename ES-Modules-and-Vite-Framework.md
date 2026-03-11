# ES Modules and Vite Framework

**Course:** CSE250 – Database Management Systems    
**Date:** March 5, 2026  

---

## What are ES Modules?

ES Modules (ESM) are the modern, official way to split JavaScript into multiple files and share code using `import` and `export` statements. They were introduced in ES6 (2015) and are now supported by modern browsers and Node.js.

Before ES Modules, Node.js commonly used **CommonJS**:

```js
// Old CommonJS way
const express = require('express');
module.exports = app;
```

With ES Modules, the same idea looks like:

```js
// Modern ES Module way
import express from 'express';
export default app;
```

---

## Basic Syntax

### Exporting

```js
// Named export
export function add(a, b) {
  return a + b;
}

// Default export
export default class Calculator {
  add(a, b) {
    return a + b;
  }
}
```

### Importing

```js
// Named import
import { add } from './math.js';

// Default import
import Calculator from './calculator.js';
```

---

## How It Connects to Our Project

Our **backend/server.js** uses ES Modules because `package.json` has `"type": "module"`.

```js
// backend/server.js
import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());
```

Without `"type": "module"` in `package.json`, Node.js would expect `require()` instead of `import` and `module.exports`. This one setting tells Node.js to treat `.js` files as ES Modules.

On the **frontend**, we can also enable ES Modules by using:

```html
<script type="module" src="main.js"></script>
```

This allows us to organize UI code into separate modules like `api/products.js`, `components/ProductList.js`, etc., and use `import`/`export` in the browser.

---

## What is Vite?

Vite is a development build tool and dev server used during application development created by Evan You (creator of Vue.js) that focuses on fast development and optimized production builds. The name "Vite" means "fast" in French.  Its purpose is to bundle frontend files (HTML, CSS, JS), enable hot module replacement, and make development fast. It is not designed to handle real-world traffic, security hardening, logging, load balancing, or scalability. Traditional bundlers like Webpack bundle **all** your files before starting the dev server, which becomes slow as the project grows. Vite avoids this during development.

---

## How Vite Uses ES Modules

In a traditional bundler:

```text
All files → Bundle everything → Serve bundle to browser
```

With Vite in development:

```text
Files → Serve as ES Modules → Browser loads only what it needs
```

The browser makes separate HTTP requests for each imported module because it **natively** understands ES Module `import` statements. For production, Vite still creates an optimized bundle using Rollup (with tree shaking, code splitting, minification).

---

## Key Difference: CommonJS vs ES Modules

| Feature        | CommonJS (`require`)           | ES Modules (`import`)             |
|----------------|--------------------------------|-----------------------------------|
| Syntax         | `require()` / `module.exports` | `import` / `export`               |
| Loading        | Dynamic (runtime)              | Static (analyzable at build time) |
| Browser use    | No (Node.js only)              | Yes (native in modern browsers)   |
| Used by Vite   | No                             | Yes                               |

---

## Summary

- ES Modules are the standard JavaScript module system using `import` and `export`.
- Our backend already uses ES Modules via `"type": "module"` in `package.json`.
- The frontend can also use ES Modules with `<script type="module">` for better organization.
- Vite is built around ES Modules; it serves them directly to the browser in development for very fast startup and HMR, and bundles with Rollup for production.