const normalizeCatalogText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const productInitials = (value: unknown) =>
  normalizeCatalogText(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

export const normalizeColdProProductSearch = normalizeCatalogText;

export function scoreColdProProductMatch(product: any, search: string) {
  const query = normalizeCatalogText(search);
  if (!query) return 0;

  const name = normalizeCatalogText(product?.name);
  const category = normalizeCatalogText(product?.category);
  const initials = productInitials(product?.name);
  const haystack = `${name} ${category}`.trim();

  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  if (initials.startsWith(query)) return 3;
  if (haystack.includes(query)) return 4;

  const queryTokens = query.split(" ").filter(Boolean);
  const haystackTokens = haystack.split(" ").filter(Boolean);
  const typoMatches = queryTokens.filter((token) => {
    const allowedDistance = token.length <= 4 ? 1 : token.length <= 8 ? 2 : 3;
    return haystackTokens.some((candidate) => candidate.startsWith(token) || levenshtein(token, candidate.slice(0, Math.max(token.length, candidate.length))) <= allowedDistance || levenshtein(token, candidate) <= allowedDistance);
  }).length;

  return typoMatches === queryTokens.length ? 5 + (queryTokens.length - typoMatches) : Number.POSITIVE_INFINITY;
}

export function filterAndRankColdProProducts(products: any[], search: string, selectedGroup = "") {
  const query = normalizeCatalogText(search);
  return products
    .filter((product) => !selectedGroup || product.category === selectedGroup)
    .map((product) => ({ product, score: query ? scoreColdProProductMatch(product, query) : 0 }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || String(a.product?.name ?? "").localeCompare(String(b.product?.name ?? ""), "pt-BR"))
    .map(({ product }) => product);
}