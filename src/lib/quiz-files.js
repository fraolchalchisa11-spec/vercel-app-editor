// Static quiz question files live in /public/quizzes (one file per exam).
// Each file is fetched only when needed and cached in memory for the session.
const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    const p = fetch(path)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        cache.delete(path);
        return [];
      });
    cache.set(path, p);
  }
  return cache.get(path);
}

/** List of { file, subject, chapter, count } */
export function loadQuizIndex() {
  return load("/quizzes/index.json");
}

export function loadQuizFile(file) {
  return load(`/quizzes/${file}`);
}

/** Apply admin overrides (locks / removals) stored in app state. */
export function applyQuizOverrides(questions, data, { includeLocked = false } = {}) {
  const locks = new Set(Array.isArray(data?.quizLocks) ? data.quizLocks : []);
  const removed = new Set(Array.isArray(data?.quizRemoved) ? data.quizRemoved : []);
  return questions
    .filter((q) => !removed.has(q.id))
    .map((q) => (locks.has(q.id) ? { ...q, locked: true } : q))
    .filter((q) => includeLocked || q.locked !== true);
}
