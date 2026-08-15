export const stripCodepoints = new Set([
      0x00ad, 0x034f, 0x061c, 0x115f, 0x1160, 0x17b4, 0x17b5,
      0x180b, 0x180c, 0x180d, 0x180e, 0x200b, 0x200c, 0x200d,
      0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
      0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067,
      0x2068, 0x2069, 0x206a, 0x206b, 0x206c, 0x206d, 0x206e,
      0x206f, 0xfeff, 0xfe00, 0xfe01, 0xfe02, 0xfe03, 0xfe04,
      0xfe05, 0xfe06, 0xfe07, 0xfe08, 0xfe09, 0xfe0a, 0xfe0b,
      0xfe0c, 0xfe0d, 0xfe0e, 0xfe0f, 0xfff9, 0xfffa, 0xfffb,
      0x180f, 0x3164, 0xffa0, 0xfffc
    ]);
export const lineSeparators = new Set([0x0085, 0x2028, 0x2029]);
export const spaces = new Set([0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x2800, 0x3000]);
export const emojiGlue = new Set([0x200d, 0xfe0e, 0xfe0f]);
export const scriptJoiners = new Set([0x200c, 0x200d]);
export const mongolianFvs = new Set([0x180b, 0x180c, 0x180d]);
export const khmerVowels = new Set([0x17b4, 0x17b5]);
export const hangulFillers = new Set([0x115f, 0x1160]);
export const scriptGlue = new Set([...mongolianFvs, ...khmerVowels, ...hangulFillers]);
export const orthographicCf = new Set([0x0600, 0x0601, 0x0602, 0x0603, 0x0604, 0x0605, 0x06dd, 0x070f, 0x08e2, 0x110bd, 0x110cd]);
export const confusables = new Map([
      [0x0410, 'A'], [0x0412, 'B'], [0x0415, 'E'], [0x041a, 'K'], [0x041c, 'M'], [0x041d, 'H'], [0x041e, 'O'], [0x0420, 'P'], [0x0421, 'C'], [0x0422, 'T'], [0x0425, 'X'],
      [0x0430, 'a'], [0x0435, 'e'], [0x043e, 'o'], [0x0440, 'p'], [0x0441, 'c'], [0x0443, 'y'], [0x0445, 'x'], [0x0456, 'i']
    ]);
    for (let codepoint = 0xff21; codepoint <= 0xff3a; codepoint += 1) confusables.set(codepoint, String.fromCharCode(codepoint - 0xfee0));
    for (let codepoint = 0xff41; codepoint <= 0xff5a; codepoint += 1) confusables.set(codepoint, String.fromCharCode(codepoint - 0xfee0));
    for (const [character, replacement] of Object.entries({ 'ѕ': 's', 'ј': 'j', 'һ': 'h', 'ԛ': 'q', 'ԝ': 'w', 'ο': 'o', 'ν': 'v', 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X' })) confusables.set(character.codePointAt(0), replacement);
export const typography = new Map([
      [0x2018, "'"], [0x2019, "'"], [0x201a, "'"], [0x201b, "'"], [0x2032, "'"], [0x2035, "'"],
      [0x201c, '"'], [0x201d, '"'], [0x201e, '"'], [0x201f, '"'], [0x2033, '"'], [0x2036, '"'],
      [0x00ab, '"'], [0x00bb, '"'], [0x2039, '"'], [0x203a, '"'],
      [0x2026, '...'], [0x2011, '-'], [0x2212, '-'], [0x2013, '-'], [0x2014, ', ']
    ]);

export const names = new Map([
      [0x00ad, 'SOFT HYPHEN'], [0x034f, 'COMBINING GRAPHEME JOINER'], [0x061c, 'ARABIC LETTER MARK'], [0x115f, 'HANGUL CHOSEONG FILLER'], [0x1160, 'HANGUL JUNGSEONG FILLER'],
      [0x17b4, 'KHMER VOWEL INHERENT AQ'], [0x17b5, 'KHMER VOWEL INHERENT AA'], [0x180b, 'MONGOLIAN FREE VARIATION SELECTOR ONE'], [0x180c, 'MONGOLIAN FREE VARIATION SELECTOR TWO'], [0x180d, 'MONGOLIAN FREE VARIATION SELECTOR THREE'], [0x180e, 'MONGOLIAN VOWEL SEPARATOR'],
      [0x200b, 'ZERO WIDTH SPACE'], [0x200c, 'ZERO WIDTH NON-JOINER'], [0x200d, 'ZERO WIDTH JOINER'], [0x200e, 'LEFT-TO-RIGHT MARK'], [0x200f, 'RIGHT-TO-LEFT MARK'], [0x202a, 'LEFT-TO-RIGHT EMBEDDING'], [0x202b, 'RIGHT-TO-LEFT EMBEDDING'], [0x202c, 'POP DIRECTIONAL FORMATTING'], [0x202d, 'LEFT-TO-RIGHT OVERRIDE'], [0x202e, 'RIGHT-TO-LEFT OVERRIDE'],
      [0x2060, 'WORD JOINER'], [0x2061, 'FUNCTION APPLICATION'], [0x2062, 'INVISIBLE TIMES'], [0x2063, 'INVISIBLE SEPARATOR'], [0x2064, 'INVISIBLE PLUS'], [0x2066, 'LEFT-TO-RIGHT ISOLATE'], [0x2067, 'RIGHT-TO-LEFT ISOLATE'], [0x2068, 'FIRST STRONG ISOLATE'], [0x2069, 'POP DIRECTIONAL ISOLATE'], [0x206a, 'INHIBIT SYMMETRIC SWAPPING'], [0x206b, 'ACTIVATE SYMMETRIC SWAPPING'], [0x206c, 'INHIBIT ARABIC FORM SHAPING'], [0x206d, 'ACTIVATE ARABIC FORM SHAPING'], [0x206e, 'NATIONAL DIGIT SHAPES'], [0x206f, 'NOMINAL DIGIT SHAPES'],
      [0xfeff, 'ZERO WIDTH NO-BREAK SPACE'], [0xfff9, 'INTERLINEAR ANNOTATION ANCHOR'], [0xfffa, 'INTERLINEAR ANNOTATION SEPARATOR'], [0xfffb, 'INTERLINEAR ANNOTATION TERMINATOR'],
      [0x00a0, 'NO-BREAK SPACE'], [0x1680, 'OGHAM SPACE MARK'], [0x2000, 'EN QUAD'], [0x2001, 'EM QUAD'], [0x2002, 'EN SPACE'], [0x2003, 'EM SPACE'], [0x2004, 'THREE-PER-EM SPACE'], [0x2005, 'FOUR-PER-EM SPACE'], [0x2006, 'SIX-PER-EM SPACE'], [0x2007, 'FIGURE SPACE'], [0x2008, 'PUNCTUATION SPACE'], [0x2009, 'THIN SPACE'], [0x200a, 'HAIR SPACE'], [0x202f, 'NARROW NO-BREAK SPACE'], [0x205f, 'MEDIUM MATHEMATICAL SPACE'], [0x3000, 'IDEOGRAPHIC SPACE']
    ]);

export const codepoints = (text) => Array.from(text);
export const isPrivateUse = (cp) => (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
export const isControl = (cp) => (cp >= 0x00 && cp <= 0x1f && ![0x09, 0x0a, 0x0d].includes(cp)) || (cp >= 0x7f && cp <= 0x9f);
export const isStrip = (cp) => stripCodepoints.has(cp) || (cp >= 0xe0100 && cp < 0xe01f0) || (cp >= 0xe0001 && cp <= 0xe007f) || isPrivateUse(cp);
export const isEmojiBase = (cp) => /\p{Extended_Pictographic}/u.test(String.fromCodePoint(cp));
export const isCjk = (character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character);
export const isFrenchSpacing = (previous, next) => /[«‹]/.test(previous ?? '') || /[»›!?;:]/.test(next ?? '');
export const isJoiningLetter = (cp) => cp > 0x7f && /[\p{L}\p{M}]/u.test(String.fromCodePoint(cp));
export const isMongolianLetter = (cp) => cp >= 0x1800 && cp <= 0x18af && /\p{L}/u.test(String.fromCodePoint(cp));
export const isKhmerLetter = (cp) => cp >= 0x1780 && cp <= 0x17ff && /\p{L}/u.test(String.fromCodePoint(cp));
export const isHangulJamo = (cp) => (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0xa960 && cp <= 0xa97c) || (cp >= 0xd7b0 && cp <= 0xd7c6);
export const isGlue = (cp) => emojiGlue.has(cp) || scriptJoiners.has(cp) || (cp >= 0xe0020 && cp < 0xe0080) || scriptGlue.has(cp);
export const isTag = (cp) => cp >= 0xe0000 && cp <= 0xe007f;
export const isLatin = (character) => /\p{Script=Latin}/u.test(character);
export const isCyrillicOrGreek = (character) => /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(character);
