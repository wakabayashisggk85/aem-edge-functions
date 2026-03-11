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

// Optional: if you want structured logging, re‑enable this and make sure log()
// can handle being called with (req, resp).
// import { log } from './lib/log.js';

const PUBLISH_HOST = 'publish-p126355-e1378027.adobeaemcloud.com';

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Always send the origin fetch to AEM Publish, not back to this Fastly service.
  const originUrl = new URL(request.url);
  originUrl.host = PUBLISH_HOST;

  const originRequest = new Request(originUrl.toString(), request);
  const originResponse = await fetch(originRequest, { backend: 'aem-publish' });

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
    'MSC Cruises': 'MSC Croisières',
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
  // log(request, finalResponse);

  return finalResponse;
}