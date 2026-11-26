/** Public origin of the store, e.g. https://rodo.ge (no trailing slash). Read at build time for metadata. */
export const siteUrl = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const absUrl = (path: string) => siteUrl() + (path.startsWith("/") ? path : `/${path}`);
