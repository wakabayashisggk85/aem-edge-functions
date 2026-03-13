/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// <reference types="@fastly/js-compute" />

import * as response from './lib/response.js';
import { log } from './lib/log.js';

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const requestUrl = new URL(request.url);
  console.log(`Received request for ${requestUrl}`);
  // fetch domain for a new url from x-forwarded-host header, but keep path/query intact
  const xForwardedHost = request.headers.get('x-forwarded-host');
  const url = new URL(`${requestUrl.protocol}//${xForwardedHost}${requestUrl.pathname}${requestUrl.search}`);
  console.log(`Received request for ${url}`);

  const originHeaders = new Headers(request.headers);
  originHeaders.set("X-EdgeFunction-Key", "a8f3b9e2c4d6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6");
  originHeaders.delete('host'); // Let the browser set the correct host header for the origin request
  originHeaders.delete('accept-encoding');
  originHeaders.set('accept-encoding', 'identity');
  // remove fastly headers
  originHeaders.delete('fastly-client-ip');
  originHeaders.delete('fastly-client');
  originHeaders.delete('fastly-ff');
  originHeaders.delete('fastly-orig-accept-encoding');
  originHeaders.delete('fastly-ssl');
  originHeaders.delete('Fastly');
  const originRequest = new Request(url, {
    method: request.method,
    headers: originHeaders,
    body: request.body
  });
  console.log(`Request to origin: ${originRequest.url} with headers: ${[...originRequest.headers.entries()]}`);
  const originResponse = await fetch(originRequest);
  console.log(`Received response from origin with status: ${originResponse.status} and headers: ${[...originResponse.headers.entries()]}`);

  // Defense in depth: only process /content/b2c/fr/fr*; otherwise just passthrough.
  if (!url.pathname.startsWith('/content/b2c/fr/fr')) {
    return originResponse;
  }

  const contentType = originResponse.headers.get('content-type') || '';
  // Only process HTML responses.
  if (!contentType.includes('text/html')) {
    return originResponse;
  }

  const originalBody = await originResponse.text();

  // --- Static token dictionary (customize as needed) ---
  const TOKEN_MAP = {
    //'MSC Cruises': 'MSC Croisières',
    'MSC': 'CBO',
    // Add more tokens here, e.g.:
    // '%%FOO%%': 'bar',
  };

  let modifiedBody = originalBody;

  // Replace all occurrences of each token in the HTML.
  for (const [token, replacement] of Object.entries(TOKEN_MAP)) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedToken, 'g');
    modifiedBody = modifiedBody.replace(regex, replacement);
  }

  // If nothing changed, return the original response (keeps streaming behavior).
  if (modifiedBody === originalBody) {
    return originResponse;
  }

  // Clone headers and remove length/encoding so Fastly recalculates correctly.
  const headers = new Headers(originResponse.headers);
  headers.delete('content-length');
  headers.delete('content-encoding'); // important if origin was gzipped

  const finalResponse = new Response(modifiedBody, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });

  // Optional logging:
  log(request, finalResponse);

  return finalResponse;
}