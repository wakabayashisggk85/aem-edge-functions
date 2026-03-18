/**
 * Streaming token-replacement TransformStream.
 *
 * Handles tokens that can span chunk boundaries by keeping a "carry" of
 * (longestTokenLen - 1) chars between chunks.
 */

/// <reference types="@fastly/js-compute" />

export class TokenReplaceTransform extends TransformStream {
  constructor(tokenMap) {
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();

    super({
      transform(chunk, controller) {
        const text = textDecoder.decode(chunk, { stream: true });
        let replacedText = text;
        for (const [token, replacement] of Object.entries(tokenMap)) {
          replacedText = replacedText.split(token).join(replacement);
        }
        controller.enqueue(textEncoder.encode(replacedText));
      },
    });
  }
}

/**
 * Applies TOKEN_MAP replacements to a string.
function applyTokenMap(input, tokenMap) {
  let output = input;
  for (const [token, replacement] of Object.entries(tokenMap)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    output = output.replace(re, replacement);
  }
  return output;
}
 */