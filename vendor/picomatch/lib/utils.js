/*global navigator*/
'use strict';

const {
  REGEX_BACKSLASH,
  REGEX_SPECIAL_CHARS,
  REGEX_SPECIAL_CHARS_GLOBAL
} = require('./constants');

exports.isObject = val => val !== null && typeof val === 'object' && !Array.isArray(val);
exports.hasRegexChars = str => REGEX_SPECIAL_CHARS.test(str);
exports.isRegexChar = str => str.length === 1 && exports.hasRegexChars(str);
exports.escapeRegex = str => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1');
exports.toPosixSlashes = str => str.replace(REGEX_BACKSLASH, '/');

exports.isWindows = () => {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    const platform = navigator.platform.toLowerCase();
    return platform === 'win32' || platform === 'windows';
  }

  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'win32';
  }

  return false;
};

// Abfahrt-Fix (CodeQL js/polynomial-redos): ursprünglich
//   str.replace(REGEX_REMOVE_BACKSLASH, m => (m === '\\' ? '' : m))
// mit /(?:\[.*?[^\\]\]|\\(?=.))/g – quadratisch bei vielen `[` ohne passende `]`. Gleiches Ergebnis in
// einem Durchlauf: Klammergruppen `[…]` bleiben unverändert, ein `\` vor einem weiteren Zeichen
// (außer Zeilenumbruch) fällt weg. Wie im Regex: `.` passt auf keinen Zeilenumbruch, `[^\\]` schon.
const isLineTerminator = ch => ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029';

exports.removeBackslashes = str => {
  const n = str.length;
  // nextClose[p]: kleinstes j >= p mit str[j] === ']' und str[j - 1] !== '\\' (sonst n)
  // nextBreak[p]: kleinstes j >= p mit Zeilenumbruch (sonst n)
  const nextClose = new Array(n + 2).fill(n);
  const nextBreak = new Array(n + 2).fill(n);
  for (let j = n - 1; j >= 0; j--) {
    nextClose[j] = str[j] === ']' && j > 0 && str[j - 1] !== '\\' ? j : nextClose[j + 1];
    nextBreak[j] = isLineTerminator(str[j]) ? j : nextBreak[j + 1];
  }

  let out = '';
  let i = 0;
  while (i < n) {
    if (str[i] === '[') {
      // kürzeste Gruppe `[` + .*? + [^\\] + `]`: Ende j >= i + 2, kein Umbruch in i+1 … j-2
      const j = nextClose[i + 2];
      if (j < n && nextBreak[i + 1] > j - 2) {
        out += str.slice(i, j + 1);
        i = j + 1;
        continue;
      }
    }
    if (str[i] === '\\' && i + 1 < n && !isLineTerminator(str[i + 1])) {
      i++;
      continue;
    }
    out += str[i];
    i++;
  }
  return out;
};

exports.escapeLast = (input, char, lastIdx) => {
  const idx = input.lastIndexOf(char, lastIdx);
  if (idx === -1) return input;
  if (input[idx - 1] === '\\') return exports.escapeLast(input, char, idx - 1);
  return `${input.slice(0, idx)}\\${input.slice(idx)}`;
};

exports.removePrefix = (input, state = {}) => {
  let output = input;
  if (output.startsWith('./')) {
    output = output.slice(2);
    state.prefix = './';
  }
  return output;
};

exports.wrapOutput = (input, state = {}, options = {}) => {
  const prepend = options.contains ? '' : '^';
  const append = options.contains ? '' : '$';

  let output = `${prepend}(?:${input})${append}`;
  if (state.negated === true) {
    output = `(?:^(?!${output}).*$)`;
  }
  return output;
};

exports.basename = (path, { windows } = {}) => {
  const segs = path.split(windows ? /[\\/]/ : '/');
  const last = segs[segs.length - 1];

  if (last === '') {
    return segs[segs.length - 2];
  }

  return last;
};
