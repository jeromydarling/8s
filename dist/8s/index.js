var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};
var HtmlEscapedCallbackPhase = {
  Stringify: 1
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  {
    return resStr;
  }
};
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono$1 = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node$1 = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node$1();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};
var Hono = class extends Hono$1 {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  };
};
const demoData = {
  family: {
    id: "fam_hollis",
    name: "The Hollis Family",
    homeTown: "Stephenville",
    state: "TX",
    plan: "Arena Pro",
    motto: "Feed before sunrise. Ride like it's the last eight seconds."
  },
  contestants: [
    {
      id: "c_rylee",
      familyId: "fam_hollis",
      firstName: "Rylee",
      lastName: "Hollis",
      age: 16,
      division: "Senior",
      associations: ["NHSRA", "NLBRA"],
      disciplines: ["Barrel Racing", "Breakaway Roping"],
      avatarSeed: "rylee-barrels",
      backNumber: "117",
      bio: "Junior at Stephenville High. Runs Dolly in the 1D and ropes calves before homework. Chasing a state finals barrel spot and her first NLBRA Top Hand season."
    },
    {
      id: "c_cade",
      familyId: "fam_hollis",
      firstName: "Cade",
      lastName: "Hollis",
      age: 13,
      division: "Junior",
      associations: ["NJHRA"],
      disciplines: ["Tie-Down Roping", "Team Roping"],
      avatarSeed: "cade-roper",
      backNumber: "44",
      bio: "Seventh grader who heels for his buddy and ties down on Chex. Up at 5 to feed, last one to leave the practice pen."
    },
    {
      id: "c_sissy",
      familyId: "fam_hollis",
      firstName: "Maelaina",
      lastName: "Hollis",
      age: 8,
      division: "Pee Wee",
      associations: ["NLBRA"],
      disciplines: ["Barrel Racing", "Goat Tying", "Dummy Roping"],
      avatarSeed: "sissy-peewee",
      backNumber: "8",
      bio: "Runs Peanut as fast as his little legs go. Collects every participation ribbon like a gold buckle."
    }
  ],
  horses: [
    {
      id: "h_dolly",
      familyId: "fam_hollis",
      name: "Famous Dolly Whiz",
      barnName: "Dolly",
      breed: "Quarter Horse",
      age: 9,
      color: "Sorrel",
      bloodlines: "Frenchmans Guy × Dash Ta Fame",
      role: "Barrel mare — Rylee's 1D horse",
      trainer: "Kasey Worrell",
      riderId: "c_rylee",
      farrierDueDays: 9,
      vetDueDays: 41,
      vaccinationsCurrent: true,
      insured: true,
      notes: "Loves deep ground. Gets strong on the first barrel — keep her gathered.",
      record: "2D average winner, 3 county wins in 2026"
    },
    {
      id: "h_boomer",
      familyId: "fam_hollis",
      name: "Boomer's Last Call",
      barnName: "Boomer",
      breed: "Quarter Horse",
      age: 12,
      color: "Bay",
      bloodlines: "Metallic Cat lineage",
      role: "Breakaway / score horse — Rylee",
      trainer: "Self",
      riderId: "c_rylee",
      farrierDueDays: 22,
      vetDueDays: 12,
      vaccinationsCurrent: true,
      insured: true,
      notes: "Scores honest. Watch the left front — slight heat after the Glen Rose run.",
      record: "Solid 2.4–2.9 breakaway times"
    },
    {
      id: "h_chex",
      familyId: "fam_hollis",
      name: "Smart Little Chex",
      barnName: "Chex",
      breed: "Quarter Horse",
      age: 10,
      color: "Buckskin",
      bloodlines: "Smart Little Lena",
      role: "Tie-down / heel horse — Cade",
      trainer: "Self",
      riderId: "c_cade",
      farrierDueDays: 3,
      vetDueDays: 60,
      vaccinationsCurrent: false,
      insured: false,
      notes: "Coggins expires before State — book the vet. Works a rope like a clock.",
      record: "Junior tie-down, two seconds at district"
    },
    {
      id: "h_peanut",
      familyId: "fam_hollis",
      name: "Mr. Peanut",
      barnName: "Peanut",
      breed: "POA Pony",
      age: 15,
      color: "Palomino",
      bloodlines: "Grade pony, heart of gold",
      role: "Pee Wee everything — Maelaina",
      trainer: "Family",
      riderId: "c_sissy",
      farrierDueDays: 17,
      vetDueDays: 88,
      vaccinationsCurrent: true,
      insured: false,
      notes: "Babysitter. Will pack anybody. Bombproof at the gate.",
      record: "Undefeated in hearts"
    }
  ],
  events: [
    {
      id: "e1",
      name: "Cross Timbers Youth Rodeo — Series #6",
      association: "NLBRA",
      disciplines: ["Barrel Racing", "Breakaway Roping", "Goat Tying", "Dummy Roping"],
      divisions: ["Pee Wee", "Junior", "Senior"],
      venue: "Erath County Arena",
      city: "Stephenville",
      state: "TX",
      startDate: "2026-06-06",
      endDate: "2026-06-07",
      entryDeadline: "2026-06-03",
      drawPosted: false,
      feePerEvent: 35,
      status: "closing-soon",
      added: true
    },
    {
      id: "e2",
      name: "NHSRA Texas State Finals",
      association: "NHSRA",
      disciplines: ["Barrel Racing", "Breakaway Roping", "Tie-Down Roping", "Team Roping"],
      divisions: ["Senior"],
      venue: "Will Rogers Memorial Center",
      city: "Fort Worth",
      state: "TX",
      startDate: "2026-06-13",
      endDate: "2026-06-20",
      entryDeadline: "2026-06-01",
      drawPosted: false,
      feePerEvent: 65,
      status: "closing-soon",
      added: true
    },
    {
      id: "e3",
      name: "Lone Star Junior Jackpot",
      association: "NJHRA",
      disciplines: ["Tie-Down Roping", "Team Roping", "Barrel Racing"],
      divisions: ["Junior"],
      venue: "Bosque County Expo",
      city: "Clifton",
      state: "TX",
      startDate: "2026-06-21",
      endDate: "2026-06-21",
      entryDeadline: "2026-06-18",
      drawPosted: false,
      feePerEvent: 40,
      status: "open",
      added: true
    },
    {
      id: "e4",
      name: "Red River Breakaway Classic",
      association: "AJRA",
      disciplines: ["Breakaway Roping"],
      divisions: ["Junior", "Senior"],
      venue: "Love County Fairgrounds",
      city: "Marietta",
      state: "OK",
      startDate: "2026-07-04",
      endDate: "2026-07-05",
      entryDeadline: "2026-06-28",
      drawPosted: false,
      feePerEvent: 50,
      status: "open",
      added: false
    },
    {
      id: "e5",
      name: "National Little Britches Finals (NLBFR)",
      association: "NLBRA",
      disciplines: ["Barrel Racing", "Breakaway Roping", "Goat Tying"],
      divisions: ["Pee Wee", "Junior", "Senior"],
      venue: "Lazy E Arena",
      city: "Guthrie",
      state: "OK",
      startDate: "2026-07-19",
      endDate: "2026-07-25",
      entryDeadline: "2026-07-01",
      drawPosted: false,
      feePerEvent: 55,
      status: "open",
      added: false
    },
    {
      id: "e6",
      name: "Glen Rose Spring Series — Finals",
      association: "NLBRA",
      disciplines: ["Barrel Racing", "Breakaway Roping", "Goat Tying"],
      divisions: ["Pee Wee", "Junior", "Senior"],
      venue: "Somervell County Expo",
      city: "Glen Rose",
      state: "TX",
      startDate: "2026-05-23",
      endDate: "2026-05-24",
      entryDeadline: "2026-05-20",
      drawPosted: true,
      feePerEvent: 35,
      status: "drawn",
      added: true
    }
  ],
  runs: [
    {
      id: "r1",
      contestantId: "c_rylee",
      horseId: "h_dolly",
      eventName: "Glen Rose Spring Series — Finals",
      discipline: "Barrel Racing",
      date: "2026-05-24",
      result: "14.812",
      placing: 1,
      points: 10,
      footing: "Deep, freshly worked",
      notes: "Best home pattern of the year. Dolly hunted every barrel."
    },
    {
      id: "r2",
      contestantId: "c_rylee",
      horseId: "h_boomer",
      eventName: "Glen Rose Spring Series — Finals",
      discipline: "Breakaway Roping",
      date: "2026-05-24",
      result: "2.61",
      placing: 3,
      points: 6,
      footing: "Firm",
      notes: "Clean catch, slow to throw slack. Boomer left front warm after."
    },
    {
      id: "r3",
      contestantId: "c_rylee",
      horseId: "h_dolly",
      eventName: "Cross Timbers Series #5",
      discipline: "Barrel Racing",
      date: "2026-05-09",
      result: "15.004",
      placing: 2,
      points: 8,
      footing: "Slick on the back side",
      notes: "Tipped nothing. Lost time leaving the third."
    },
    {
      id: "r4",
      contestantId: "c_cade",
      horseId: "h_chex",
      eventName: "Lone Star Junior Jackpot #4",
      discipline: "Tie-Down Roping",
      date: "2026-05-17",
      result: "11.9",
      placing: 2,
      points: 8,
      footing: "Good",
      notes: "Great corner, fumbled the tie. Chex was money."
    },
    {
      id: "r5",
      contestantId: "c_sissy",
      horseId: "h_peanut",
      eventName: "Glen Rose Spring Series — Finals",
      discipline: "Barrel Racing",
      date: "2026-05-24",
      result: "19.430",
      placing: 4,
      points: 4,
      footing: "Deep",
      notes: "Smiled the whole pattern. Stayed in the saddle on the turn!"
    },
    {
      id: "r6",
      contestantId: "c_rylee",
      horseId: "h_dolly",
      eventName: "Cross Timbers Series #4",
      discipline: "Barrel Racing",
      date: "2026-04-25",
      result: "14.939",
      placing: 1,
      points: 10,
      footing: "Worked twice",
      notes: "Won the 1D. Money run."
    }
  ],
  ladders: [
    {
      id: "l1",
      contestantId: "c_rylee",
      pathway: "NHSRA",
      discipline: "Barrel Racing",
      title: "Road to State Finals — Barrels",
      currentPoints: 248,
      targetPoints: 300,
      standing: "3rd in District 9",
      status: "on-track",
      nextDeadline: "2026-06-01",
      nextDeadlineLabel: "State entry closes",
      stages: [
        { label: "District Rodeos", state: "done", detail: "8 of 10 counted" },
        { label: "District Finals", state: "current", detail: "3rd — top 4 advance" },
        { label: "State Finals", state: "upcoming", detail: "Fort Worth, Jun 13" },
        { label: "Nationals (NHSFR)", state: "upcoming", detail: "Rock Springs, WY" }
      ]
    },
    {
      id: "l2",
      contestantId: "c_rylee",
      pathway: "NLBRA",
      discipline: "Breakaway Roping",
      title: "Top Hand Team — Breakaway",
      currentPoints: 3,
      targetPoints: 5,
      standing: "3 of 5 firsts",
      status: "at-risk",
      nextDeadline: "2026-07-01",
      nextDeadlineLabel: "NLBFR entry closes",
      stages: [
        { label: "Franchise Rodeos", state: "done", detail: "11 entered" },
        { label: "Top Hand Points", state: "current", detail: "3 of 5 first-place finishes" },
        { label: "NLBFR — Guthrie", state: "upcoming", detail: "Jul 19–25" }
      ]
    },
    {
      id: "l3",
      contestantId: "c_cade",
      pathway: "NJHRA",
      discipline: "Tie-Down Roping",
      title: "Road to State — Tie-Down",
      currentPoints: 162,
      targetPoints: 220,
      standing: "6th in district",
      status: "watch",
      nextDeadline: "2026-06-18",
      nextDeadlineLabel: "Need 2 strong jackpots",
      stages: [
        { label: "District Rodeos", state: "current", detail: "6th — top 4 advance" },
        { label: "District Finals", state: "upcoming", detail: "Two events left" },
        { label: "State Finals", state: "upcoming", detail: "Abilene, TX" }
      ]
    }
  ],
  sponsors: [
    {
      id: "s1",
      contestantId: "c_rylee",
      brand: "Lone Star Feed & Supply",
      category: "Feed store",
      tier: "Gold",
      annualValue: 2400,
      status: "active",
      renewalDate: "2026-12-01",
      deliverablesDone: 4,
      deliverablesTotal: 6
    },
    {
      id: "s2",
      contestantId: "c_rylee",
      brand: "Bar-H Saddlery",
      category: "Tack & leather",
      tier: "Silver",
      annualValue: 1200,
      status: "renewal-due",
      renewalDate: "2026-06-15",
      deliverablesDone: 5,
      deliverablesTotal: 5
    },
    {
      id: "s3",
      contestantId: "c_cade",
      brand: "Cross Timbers Vet Clinic",
      category: "Veterinary",
      tier: "Bronze",
      annualValue: 600,
      status: "pending",
      renewalDate: "2026-08-01",
      deliverablesDone: 1,
      deliverablesTotal: 4
    }
  ],
  arenas: [
    {
      id: "a1",
      name: "Erath County Arena",
      city: "Stephenville",
      state: "TX",
      status: "safe",
      yearsActive: 47,
      threat: "Stable — community-owned",
      story: "Home ground. The Hollis kids took their first laps here. A model for what a protected arena looks like.",
      signatures: 0,
      signatureGoal: 0,
      economicImpact: 19e5,
      supporters: 312
    },
    {
      id: "a2",
      name: "Sand Springs Rodeo Arena",
      city: "Sand Springs",
      state: "OK",
      status: "saved",
      yearsActive: 60,
      threat: "City council voted to close (2017) — community fought back and won",
      story: "Residents launched a petition and packed the council chambers. Proof that organized families can keep an arena open.",
      signatures: 4200,
      signatureGoal: 4e3,
      economicImpact: 85e4,
      supporters: 1180
    },
    {
      id: "a3",
      name: "Jackson Hole Rodeo Grounds",
      city: "Jackson",
      state: "WY",
      status: "threatened",
      yearsActive: 80,
      threat: "Rezoning for housing ahead of a 2026 lease expiration",
      story: "A grassroots 'Save the Rodeo Grounds' campaign gathered 1,300+ signatures. The fight is live and needs every voice.",
      signatures: 1340,
      signatureGoal: 5e3,
      economicImpact: 34e5,
      supporters: 920
    },
    {
      id: "a4",
      name: "South Tippecanoe Rodeo & Concert Venue",
      city: "Lafayette",
      state: "IN",
      status: "threatened",
      yearsActive: 4,
      threat: "Shut down over noise complaints and a zoning denial",
      story: "A family-owned venue silenced before it found its footing. Documenting its economic impact is the first step to reopening.",
      signatures: 610,
      signatureGoal: 3e3,
      economicImpact: 42e4,
      supporters: 230
    }
  ],
  budget: [
    { category: "Entry fees", spent: 3140, budget: 6e3 },
    { category: "Horse care", spent: 7820, budget: 12e3 },
    { category: "Travel & fuel", spent: 4310, budget: 8e3 },
    { category: "Gear & tack", spent: 1960, budget: 3e3 },
    { category: "Memberships", spent: 540, budget: 700 }
  ],
  season: {
    spend: 17770,
    eventsEntered: 23,
    milesTraveled: 6840,
    buckles: 4
  }
};
const SYSTEM = `You are the import engine for "8 Seconds", a youth rodeo family app.
Families paste messy historical data (CSV, spreadsheet dumps, copied results pages, hand-typed notes).
Extract and normalize it into clean records. Recognize rodeo concepts:
- contestants (riders / kids) with name, age, division (Pee Wee/Junior/Senior)
- horses with name, breed, role
- events / rodeos with name, date, location, association
- runs / results with discipline, time-or-score, placing
Return ONLY valid JSON, no prose, matching:
{"summary": string, "records": [{"type": "contestant|horse|event|run", ...fields}], "warnings": [string]}
Keep field names lowercase snake_case. Infer division from age when possible. Be generous in parsing dates and times.`;
async function runImport(text, filename, ai) {
  if (ai) {
    try {
      const res = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Source: ${filename}

Data:
${text}` }
        ],
        max_tokens: 2048,
        temperature: 0.1
      });
      const parsed = extractJson(res.response ?? "");
      if (parsed) return shape(parsed, filename, true);
    } catch (err) {
      console.error("AI import failed, using heuristic", err);
    }
  }
  return heuristic(text, filename);
}
function extractJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
function shape(parsed, filename, fromAi) {
  const records = (parsed.records ?? []).filter(Boolean).slice(0, 200);
  const counts = { contestants: 0, horses: 0, runs: 0, events: 0 };
  for (const r of records) {
    if (r.type === "contestant") counts.contestants++;
    else if (r.type === "horse") counts.horses++;
    else if (r.type === "event") counts.events++;
    else if (r.type === "run") counts.runs++;
  }
  return {
    summary: parsed.summary ?? `Synthesized ${records.length} records from ${filename}.`,
    detected: counts,
    records: records.map((r) => r),
    warnings: parsed.warnings ?? [],
    mappedFrom: fromAi ? "Cloudflare AI (Llama 3.3)" : "heuristic parser"
  };
}
function heuristic(text, filename) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      summary: "Nothing recognizable to import.",
      detected: { contestants: 0, horses: 0, runs: 0, events: 0 },
      records: [],
      warnings: ["No rows detected."],
      mappedFrom: "heuristic parser"
    };
  }
  const delim = guessDelim(lines[0]);
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  const hasHeader = header.some(
    (h) => /name|horse|time|date|event|placing|rider|discipline|age/.test(h)
  );
  const rows = (hasHeader ? lines.slice(1) : lines).slice(0, 200);
  const cols = hasHeader ? header : guessColumns(rows[0]?.split(delim).length ?? 1);
  const records = [];
  const counts = { contestants: 0, horses: 0, runs: 0, events: 0 };
  for (const line of rows) {
    const cells = line.split(delim).map((c) => c.trim());
    const rec = {};
    cols.forEach((col, i) => rec[col] = cells[i] ?? null);
    const hasTime = cols.some((c) => /time|score|result|placing/.test(c));
    const hasHorse = cols.some((c) => /horse/.test(c));
    if (hasTime) {
      rec.type = "run";
      counts.runs++;
    } else if (hasHorse) {
      rec.type = "horse";
      counts.horses++;
    } else if (cols.some((c) => /event|rodeo|venue/.test(c))) {
      rec.type = "event";
      counts.events++;
    } else {
      rec.type = "contestant";
      counts.contestants++;
    }
    records.push(rec);
  }
  return {
    summary: `Parsed ${records.length} rows from ${filename}. Connect Cloudflare AI for smarter mapping of free-form data.`,
    detected: counts,
    records,
    warnings: hasHeader ? [] : ["No header row detected — columns were inferred."],
    mappedFrom: "heuristic parser"
  };
}
function guessDelim(line) {
  if (line.includes("	")) return "	";
  if (line.split(",").length >= line.split(";").length) return ",";
  return ";";
}
function guessColumns(n) {
  const base = ["name", "horse", "event", "discipline", "result", "placing", "date"];
  return Array.from({ length: n }, (_, i) => base[i] ?? `field_${i + 1}`);
}
const PRESETS = {
  hero: {
    prompt: "loose watercolor painting of a wide open West Texas valley at golden hour, distant mesa, dry grass, soft washes, muted ochre and dusty sage, lots of negative space, no people, no text",
    palette: ["#f4e3c4", "#f0cfa0", "#d99c6a", "#b06b4a", "#7c4a35"],
    sun: "#fbe3b3"
  },
  rider: {
    prompt: "minimal watercolor of a lone barrel racer and horse silhouette against a warm dusk sky, soft bleeding edges, dusty rose and amber, no text",
    palette: ["#f6e7cb", "#f2c98f", "#d98e63", "#9c5a44", "#5e3829"],
    sun: "#f9d79e",
    silhouette: "rider"
  },
  horse: {
    prompt: "watercolor study of a quarter horse grazing at sunrise, sage and cream tones, soft washes, no text",
    palette: ["#eef0df", "#e6d9b0", "#c9a878", "#8f7350", "#5b4a32"],
    sun: "#f3ead0",
    silhouette: "horse"
  },
  arena: {
    prompt: "watercolor of a small town rodeo arena at dusk, wooden fence, stadium lights warming up, prairie behind, muted nostalgic palette, no text",
    palette: ["#e9dcc2", "#e0c190", "#c98f63", "#7e5640", "#3f2c20"],
    sun: "#f6d9a0",
    silhouette: "fence"
  },
  community: {
    prompt: "watercolor of families gathered at a country fairground in the evening, warm lantern light, sense of belonging, soft and tender, no text",
    palette: ["#f3e6cf", "#efc98f", "#dd9a62", "#a3654a", "#5d3a2b"],
    sun: "#fbe0ad"
  },
  trail: {
    prompt: "watercolor of an open prairie trail under a big sky with drifting clouds, sage green and warm sand, expansive, no text",
    palette: ["#eef2e6", "#e7d6ad", "#cdb07f", "#9aa06a", "#5f6b42"],
    sun: "#f5eccf",
    silhouette: "fence"
  }
};
async function generateArt(c, slug) {
  const preset = PRESETS[slug] ?? PRESETS.hero;
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  try {
    const origin = new URL(c.req.url).origin;
    const curated = await c.env.ASSETS.fetch(new Request(`${origin}/art/${slug}.jpg`));
    if (curated.ok && (curated.headers.get("content-type") ?? "").startsWith("image")) {
      const resp2 = new Response(curated.body, {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" }
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, resp2.clone()));
      return resp2;
    }
  } catch {
  }
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(`art/${slug}.jpg`).catch(() => null);
    if (obj) {
      const resp2 = new Response(obj.body, {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" }
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, resp2.clone()));
      return resp2;
    }
  }
  if (c.env.AI) {
    try {
      const out = await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: preset.prompt,
        steps: 6
      });
      if (out.image) {
        const bytes = Uint8Array.from(atob(out.image), (ch) => ch.charCodeAt(0));
        if (c.env.MEDIA) {
          c.executionCtx.waitUntil(
            c.env.MEDIA.put(`art/${slug}.jpg`, bytes, {
              httpMetadata: { contentType: "image/jpeg" }
            }).then(() => void 0)
          );
        }
        const resp2 = new Response(bytes, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        });
        c.executionCtx.waitUntil(cache.put(cacheKey, resp2.clone()));
        return resp2;
      }
    } catch (err) {
      console.error("AI art generation failed, serving SVG", err);
    }
  }
  const svg = watercolorSvg(preset, slug);
  const resp = new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400"
    }
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}
function watercolorSvg(p, seed) {
  const W = 1600;
  const H = 1e3;
  const s = hash(seed);
  const sunX = 380 + s % 400;
  const sunY = 300 + (s >> 3) % 120;
  const silhouette = renderSilhouette(p.silhouette, W, H);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.palette[0]}"/>
      <stop offset="55%" stop-color="${p.palette[1]}"/>
      <stop offset="100%" stop-color="${p.palette[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${sunX / W * 100}%" cy="${sunY / H * 100}%" r="60%">
      <stop offset="0%" stop-color="${p.sun}" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="${p.sun}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${p.sun}" stop-opacity="0"/>
    </radialGradient>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${s % 97}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="bleed" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${(s >> 2) % 50}" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="38"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="120" fill="${p.sun}" opacity="0.9" filter="url(#bleed)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <g filter="url(#wash)" opacity="0.96">
    <path d="M0 ${H * 0.62} ${hills(W, H * 0.62, 5, s)} L${W} ${H} L0 ${H} Z" fill="${p.palette[2]}" opacity="0.75"/>
    <path d="M0 ${H * 0.72} ${hills(W, H * 0.72, 4, s + 7)} L${W} ${H} L0 ${H} Z" fill="${p.palette[3]}" opacity="0.85"/>
    <path d="M0 ${H * 0.84} ${hills(W, H * 0.84, 6, s + 19)} L${W} ${H} L0 ${H} Z" fill="${p.palette[4]}"/>
  </g>

  ${silhouette}

  <rect width="${W}" height="${H}" filter="url(#paper)" opacity="0.6"/>
</svg>`;
}
function hills(w, baseY, segments, seed) {
  let d = "";
  const step = w / segments;
  for (let i = 1; i <= segments; i++) {
    const x = i * step;
    const cx = x - step / 2;
    const cy = baseY + (seed * (i + 3) % 70 - 35);
    d += ` Q${cx.toFixed(0)} ${cy.toFixed(0)} ${x.toFixed(0)} ${(baseY + (seed * i % 30 - 15)).toFixed(0)}`;
  }
  return d;
}
function renderSilhouette(kind, W, H) {
  const y = H * 0.84;
  if (kind === "fence") {
    let posts = "";
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * ((W - 240) / 8);
      posts += `<rect x="${x}" y="${y - 90}" width="10" height="95" fill="#2c1d12" opacity="0.55"/>`;
    }
    return `<g opacity="0.6"><line x1="120" y1="${y - 70}" x2="${W - 120}" y2="${y - 70}" stroke="#2c1d12" stroke-width="3"/><line x1="120" y1="${y - 40}" x2="${W - 120}" y2="${y - 40}" stroke="#2c1d12" stroke-width="3"/>${posts}</g>`;
  }
  if (kind === "horse") {
    return `<g transform="translate(${W * 0.62} ${y - 150}) scale(1.7)" fill="#241710" opacity="0.7">
      <path d="M10 60 q5 -30 25 -34 q6 -14 18 -10 q-2 8 -8 10 q14 2 26 10 q10 -2 16 4 q-6 4 -14 2 q4 14 -2 30 l-6 0 q2 -14 -2 -24 q-10 6 -24 6 q2 12 -2 22 l-6 0 q-2 -12 0 -22 q-12 -2 -18 -10 q-2 14 -2 22 l-6 0 q-2 -16 0 -28 z"/>
    </g>`;
  }
  if (kind === "rider") {
    return `<g transform="translate(${W * 0.58} ${y - 175}) scale(1.9)" fill="#1f140d" opacity="0.72">
      <path d="M6 70 q4 -26 22 -30 q4 -16 16 -16 q8 0 8 8 q0 6 -6 8 q10 2 18 10 q9 -3 15 3 q-5 4 -12 3 q4 12 0 26 l-5 0 q2 -12 -1 -21 q-9 5 -21 5 q1 11 -2 20 l-6 0 q-1 -11 1 -20 q-11 -2 -17 -9 q-2 12 -1 20 l-6 0 q-2 -14 -2 -25 z"/>
      <circle cx="40" cy="20" r="5"/><path d="M33 18 q7 -8 14 0 z"/>
    </g>`;
  }
  return "";
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const app = new Hono();
app.use("/api/*", cors());
app.get(
  "/api/health",
  (c) => c.json({
    ok: true,
    app: c.env.APP_NAME,
    bindings: {
      ai: !!c.env.AI,
      db: !!c.env.DB,
      leads: !!c.env.LEADS,
      media: !!c.env.MEDIA
    }
  })
);
app.get("/api/demo", (c) => c.json(demoData));
app.post("/api/leads", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) || !body?.name) {
    return c.json({ error: "Name and a valid email are required." }, 422);
  }
  const lead = {
    id: crypto.randomUUID(),
    name: String(body.name).slice(0, 120),
    email: String(body.email).slice(0, 160).toLowerCase(),
    role: String(body.role ?? "").slice(0, 60),
    org: String(body.org ?? "").slice(0, 120),
    state: String(body.state ?? "").slice(0, 40),
    disciplines: String(body.disciplines ?? "").slice(0, 200),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    if (c.env.DB) {
      await c.env.DB.prepare(
        `INSERT INTO leads (id, name, email, role, org, state, disciplines, created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(
        lead.id,
        lead.name,
        lead.email,
        lead.role,
        lead.org,
        lead.state,
        lead.disciplines,
        lead.createdAt
      ).run();
    } else if (c.env.LEADS) {
      await c.env.LEADS.put(`lead:${lead.createdAt}:${lead.id}`, JSON.stringify(lead));
    } else {
      console.log("[lead]", JSON.stringify(lead));
    }
  } catch (err) {
    console.error("lead persistence failed", err);
  }
  const token = btoa(`${lead.id}:${Date.now()}`);
  c.header(
    "Set-Cookie",
    `eight_demo=${token}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`
  );
  return c.json({ ok: true, demoToken: token });
});
app.post("/api/import", async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const text = (payload.text ?? "").slice(0, 12e3);
  if (!text.trim()) return c.json({ error: "Paste some data to import." }, 422);
  const result = await runImport(text, payload.filename ?? "pasted-data", c.env.AI);
  return c.json(result);
});
app.get("/api/art/:slug", async (c) => {
  const slug = c.req.param("slug");
  return generateArt(c, slug);
});
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
const workerEntry = app ?? {};
export {
  workerEntry as default
};
