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
import { FR_TOKEN_MAP, AT_TOKEN_MAP, FR_PATTERN_RULES, AT_PATTERN_RULES, ALLOWED_LOCALES } from './lib/localeData.js';

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const requestUrl = new URL(request.url);
  //console.log(`Received request on ${requestUrl}`);
  // fetch domain for a new url from x-forwarded-host header, but keep path/query intact
  const host = getAemBackend(request.headers.get('host'));
  console.log(`Host header: ${host}`);
  const xForwardedHost = request.headers.get('x-forwarded-host');
  console.log(`X-Forwarded-Host header: ${xForwardedHost}`);
  const url = new URL(`${requestUrl.protocol}//${host}${requestUrl.pathname}${requestUrl.search}`);
  
  // tune headers for origin request
  const originHeaders = new Headers(request.headers);
  originHeaders.set("X-EdgeFunction-Key", "a8f3b9e2c4d6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6");
  // Let the browser set the correct host header for the origin request
  originHeaders.delete('host'); 
  // remove fastly headers
  originHeaders.delete('cdn-loop');
  originHeaders.delete('via');
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
  //console.log(`Request to origin: ${originRequest.url} with headers: ${[...originRequest.headers.entries()]}`);

  const originResponse = await fetch(originRequest);
  //console.log(`Received response from origin with status: ${originResponse.status} and headers: ${[...originResponse.headers.entries()]}`);

  const contentType = originResponse.headers.get('content-type') || '';
  // Only process HTML responses.
  if (!contentType.includes('text/html') && !contentType.includes('application/json') && !contentType.includes('application/graphql')) {
    console.log(`Content-Type ${contentType} is not HTML or JSON. Returning original response without modification.`);
    return originResponse;
  }

  let currentTokenMap = {};
  let currentPatternRules = [];
  // Assign correct token map for urls starting with /graphql/execute.json that contains locale params "*locale%3Dfr_FR*" where fr_FR is from the ALLOWED_LOCALES list
  if (requestUrl.pathname.startsWith('/graphql/execute.json')) {
    const path = requestUrl.pathname;
    if (path.includes('fr_FR')) {
        currentTokenMap = FR_TOKEN_MAP;
        currentPatternRules = FR_PATTERN_RULES;
        //console.log(`Locale param inside ${path} matched. Using FR token map.`);
    } else if (path.includes('de_AT')) {
        currentTokenMap = AT_TOKEN_MAP;
        currentPatternRules = AT_PATTERN_RULES;
        //console.log(`Locale param inside ${path} matched. Using AT token map.`);
    } else {
      // If no valid locale param, return original response without modification
      console.log(`No valid locale param found in query string. Returning original response without modification.`);
      return originResponse;
    }
  } else {
    // For non-graphql requests, determine token map based on x-forwarded-host header
    if (xForwardedHost.includes('fr')) {
      currentTokenMap = FR_TOKEN_MAP;
      currentPatternRules = FR_PATTERN_RULES;
      //console.log(`x-forwarded-host ${xForwardedHost} matched 'fr'. Using FR token map.`);
    } else if (xForwardedHost.includes('at')) {
      currentTokenMap = AT_TOKEN_MAP;
      currentPatternRules = AT_PATTERN_RULES;
      //console.log(`x-forwarded-host ${xForwardedHost} matched 'at'. Using AT token map.`);
    }
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
    //console.log(`Content is gzip encoded. Added decompression stream to pipeline.`);
  }

  // Apply token replacement as a streaming transform
  let replacedStream = readable.pipeThrough(
    new TokenReplaceTransform(currentTokenMap, currentPatternRules)
  );
  //console.log(`Applied TokenReplaceTransform with current token map and pattern rules to the response stream.`);

  if (encoding.includes('gzip')) {
    // Compress in-process (as per Fastly docs) and add back encoding header
    replacedStream = replacedStream.pipeThrough(new CompressionStream('gzip'));
    respHeaders.set('content-encoding', 'gzip');
    //console.log(`Re-compressed response stream with gzip and set content-encoding header accordingly.`);
  }

  const finalResponse = new Response(replacedStream, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: respHeaders,
  });

  //log(request, finalResponse);

  return finalResponse;
}

function getAemBackend(host) {
  if (!host) {
    console.log(`No host header found in request.`);
    return null;
  }

  // Matches: edgefunction-p126355-e1303990-token-replace.adobeaemcloud.com
  const m = host.match(/(p\d+-e\d+)/);

  if (!m) {
    console.log(`Could not parse compute host for publish mapping: ${host}`);
    return null;
  }

  const environment = m[1];
  return `publish-${environment}.adobeaemcloud.com`;
}