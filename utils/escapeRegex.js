// Escapes user input before it is placed inside a RegExp, so "(" or ".*" from a URL
// can't change the meaning of the query or trigger catastrophic backtracking.
export const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Case-insensitive exact match, safe for user input.
export const exactInsensitive = (value = "") => new RegExp(`^${escapeRegex(String(value).trim())}$`, "i");
