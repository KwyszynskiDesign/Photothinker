const POLISH_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};

export function slugify(name: string): string {
  const transliterated = name
    .trim()
    .toLowerCase()
    .split('')
    .map(ch => POLISH_MAP[ch] ?? ch)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || 'wydarzenie';
}
