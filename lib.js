// lib.js — pure, side-effect-free bookmark operations.
//
// Kept separate from index.js (which owns the CLI wiring, filesystem, and
// inquirer prompts) so this logic can be unit-tested without a TTY or disk.
// Every function takes plain objects and returns new ones; nothing here reads
// the environment, the clock, or the filesystem (prune takes an existsFn so the
// caller injects fs.existsSync).

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Validate a proposed bookmark name. Returns { ok: true, name } with the
// trimmed name, or { ok: false, error } with a human-readable reason. Names
// must be a single shell-safe token so `goto <name>` and tab-completion work.
function validateName(rawName, config, { force = false } = {}) {
  const name = String(rawName == null ? '' : rawName).trim();
  if (name.length === 0) {
    return { ok: false, error: 'Name cannot be empty' };
  }
  if (/\s/.test(name)) {
    return { ok: false, error: 'Name cannot contain whitespace' };
  }
  if (name.startsWith('-')) {
    return { ok: false, error: 'Name cannot start with "-" (reserved for flags)' };
  }
  if (!force && has(config, name)) {
    return { ok: false, error: `Bookmark "${name}" already exists (use --force to overwrite)` };
  }
  return { ok: true, name };
}

// Add (or, with force, overwrite) a bookmark pointing at targetPath. New
// bookmarks are prepended so that, with equal usage, the newest sorts first.
function addBookmark(config, rawName, targetPath, { force = false } = {}) {
  const res = validateName(rawName, config, { force });
  if (!res.ok) return res;
  const name = res.name;
  const updated = has(config, name);
  const next = { [name]: targetPath };
  for (const [k, v] of Object.entries(config)) {
    if (k !== name) next[k] = v;
  }
  return { ok: true, name, updated, config: next };
}

// Remove a bookmark and its usage record.
function removeBookmark(config, usage, name) {
  if (!has(config, name)) {
    return { ok: false, error: `Bookmark "${name}" not found` };
  }
  const nextConfig = { ...config };
  delete nextConfig[name];
  const nextUsage = { ...usage };
  delete nextUsage[name];
  return { ok: true, name, config: nextConfig, usage: nextUsage };
}

// Rename a bookmark, carrying its usage timestamp across so recency ordering is
// preserved. Renaming to the same name is a harmless no-op.
function renameBookmark(config, usage, oldName, rawNewName) {
  if (!has(config, oldName)) {
    return { ok: false, error: `Bookmark "${oldName}" not found` };
  }
  // Validate against the config minus the old name so a same-name rename (and
  // case/format checks) pass without a spurious "already exists".
  const { [oldName]: _omit, ...rest } = config;
  const res = validateName(rawNewName, rest);
  if (!res.ok) return res;
  const newName = res.name;

  const nextConfig = {};
  for (const [k, v] of Object.entries(config)) {
    nextConfig[k === oldName ? newName : k] = v;
  }
  const nextUsage = { ...usage };
  if (has(nextUsage, oldName)) {
    nextUsage[newName] = nextUsage[oldName];
    if (newName !== oldName) delete nextUsage[oldName];
  }
  return { ok: true, oldName, newName, config: nextConfig, usage: nextUsage };
}

// Drop every bookmark whose path fails existsFn. Returns the removed names plus
// the pruned config/usage.
function pruneBookmarks(config, usage, existsFn) {
  const removed = Object.keys(config).filter((name) => !existsFn(config[name]));
  const nextConfig = { ...config };
  const nextUsage = { ...usage };
  for (const name of removed) {
    delete nextConfig[name];
    delete nextUsage[name];
  }
  return { removed, config: nextConfig, usage: nextUsage };
}

// Order names by most-recently-used first. Never-used names keep their original
// (config) order and sort after used ones, since sort is stable.
function orderByLastUsed(names, usage) {
  return [...names].sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
}

// Compact human-readable "time ago". `now` is injectable for deterministic
// tests; it defaults to the current time.
function timeAgo(ts, now) {
  if (!ts) return 'never used';
  const ref = now === undefined ? Date.now() : now;
  const secs = Math.floor((ref - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

module.exports = {
  validateName,
  addBookmark,
  removeBookmark,
  renameBookmark,
  pruneBookmarks,
  orderByLastUsed,
  timeAgo,
};
