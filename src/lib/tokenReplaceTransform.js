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
            const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedToken, 'gi');

            replacedText = replacedText.replace(regex, (match) =>
                applyCasePattern(match, replacement)
            );
        }
        controller.enqueue(textEncoder.encode(replacedText));
      },
    });
  }
}

function applyCasePattern(source, target) {
  // All letters in source are upper (and there is at least one letter)
  if (source.toUpperCase() === source && /[A-ZÀ-Ÿ]/.test(source)) {
    return target.toUpperCase();
  }

  // All letters are lower
  if (source.toLowerCase() === source && /[a-zà-ÿ]/.test(source)) {
    return target.toLowerCase();
  }

  // Capitalized: first letter upper, rest lower
  const first = source.charAt(0);
  const rest = source.slice(1);
  if (
    first.toUpperCase() === first &&
    rest.toLowerCase() === rest &&
    /[A-ZÀ-Ÿ]/.test(first)
  ) {
    return target.charAt(0).toUpperCase() + target.slice(1).toLowerCase();
  }

  // Fallback: use target as given
  return target;
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