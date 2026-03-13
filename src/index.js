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
  const url = new URL(request.url);

  // request è su adobeaemcloud.com, la cdn la intercetta ma la mia request è di nuovo adobeaemcloud.com e quindi vado in loop

  const originHeaders = new Headers(request.headers);
  //originHeaders.set("X-EdgeFunction-Key", "a8f3b9e2c4d6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6");
  const originRequest = new Request("https://www.msccruises.co.uk/msc-yacht-club", {
    method: request.method
  });
  //const originResponse = await fetch(originRequest);
  const originResponse = await fetch(originRequest);
  
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
    'MSC Yacht Club': 'MSC Exclusive Club'
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