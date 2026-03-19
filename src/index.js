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
// import * as response from './lib/response.js';
import { log } from './lib/log.js';
import { TokenReplaceTransform } from './lib/tokenReplaceTransform.js';

// France token dictionary
const FR_TOKEN_MAP = {
  'MSC Cruises': 'MSC Croisières',
  'MSC CRUISES': 'MSC CROISIÈRES'
  // Add more tokens here...
};

// Austrian token dictionary
const AT_TOKEN_MAP = {
  'massgeschneiderte': 'maßgeschneiderte',
  'massstäbe': 'maßstäbe',
  // Add more tokens here...
};

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const requestUrl = new URL(request.url);
  console.log(`Received request for ${requestUrl}`);
  // fetch domain for a new url from x-forwarded-host header, but keep path/query intact
  const xForwardedHost = request.headers.get('x-forwarded-host');
  const url = new URL(`${requestUrl.protocol}//${xForwardedHost}${requestUrl.pathname}${requestUrl.search}`);
  console.log(`Received request for ${url}`);

  // tune headers for origin request
  const originHeaders = new Headers(request.headers);
  originHeaders.set("X-EdgeFunction-Key", "a8f3b9e2c4d6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6");
  // Let the browser set the correct host header for the origin request
  originHeaders.delete('host'); 
  // Force identity encoding to ensure we get the full HTML for modification (no gzip).
  // originHeaders.delete('accept-encoding');
  // originHeaders.set('accept-encoding', 'identity');
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

  const contentType = originResponse.headers.get('content-type') || '';
  // Only process HTML responses.
  if (!contentType.includes('text/html') && !contentType.includes('application/json') && !contentType.includes('application/graphql-response+json')) {
    return originResponse;
  }

  let currentTokenMap = {};
  //let currentTokenMap = FR_TOKEN_MAP; // default for RDE testing
  if (xForwardedHost.includes('fr')) {
    currentTokenMap = FR_TOKEN_MAP;
  } else if (xForwardedHost.includes('at')) {
    currentTokenMap = AT_TOKEN_MAP;
  }

  // Clone headers and clear length/encoding (we will modify body)
  const respHeaders = new Headers(originResponse.headers);
  const encoding = respHeaders.get('content-encoding') || '';
  respHeaders.delete('content-length');
  respHeaders.delete('content-encoding'); // ensure body & headers are consistent

  // Build streaming pipeline:
  // origin body -> (optional) DecompressionStream -> TextDecoderStream
  let readable = originResponse.body;

  if (encoding.includes('gzip')) {
    // Decompress in-process (as per Fastly docs)
    readable = readable.pipeThrough(new DecompressionStream('gzip'));
  }

  // Apply token replacement as a streaming transform
  let replacedStream = readable.pipeThrough(
    new TokenReplaceTransform(currentTokenMap)
  );

  if (encoding.includes('gzip')) {
    // Compress in-process (as per Fastly docs) and add back encoding header
    replacedStream = replacedStream.pipeThrough(new CompressionStream('gzip'));
    respHeaders.set('content-encoding', 'gzip');
  }

  const finalResponse = new Response(replacedStream, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: respHeaders,
  });

  log(request, finalResponse);

  return finalResponse;
}
