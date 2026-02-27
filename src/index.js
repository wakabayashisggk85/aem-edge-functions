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

import { log } from './lib/log.js';

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Optional defense in depth: path guard (CDN config already restricts this)
  if (!url.pathname.includes('/fr/fr')) {
    // Just pass through to origin unchanged
    return fetch(request);
  }

  // Fetch from the configured AEM backend (default backend for this service)
  const originResponse = await fetch(request);

  const contentType = originResponse.headers.get('content-type') || '';
  // Only process HTML responses
  if (!contentType.includes('text/html')) {
    return originResponse;
  }

  const originalBody = await originResponse.text();

  // --- Static token dictionary (customize as needed) ---
  // Keys are the tokens to search for in the HTML, values are replacements.
  const TOKEN_MAP = {
    'MSC Cruises': 'MSC Croisières'
    // Add more tokens here
    // '%%FOO%%': 'bar',
  };

  let modifiedBody = originalBody;

  // Replace all occurrences of each token in the HTML
  for (const [token, replacement] of Object.entries(TOKEN_MAP)) {
    // Escape regex meta characters in the token
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedToken, 'g');
    modifiedBody = modifiedBody.replace(regex, replacement);
  }

  // If nothing changed, return the original response (keeps streaming behavior)
  if (modifiedBody === originalBody) {
    return originResponse;
  }

  // Clone headers and remove content-length so it can be recalculated
  const headers = new Headers(originResponse.headers);
  headers.delete('content-length');

  let finalResponse = new Response(modifiedBody, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });

  // Log the request and response
  log(req, finalResponse);

  return finalResponse; 
}

