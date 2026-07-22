const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}`;
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) buckets.set(key, { start: now, count: 1 });
    else if (++bucket.count > max) return res.status(429).json({ error: "Too many requests" });
    if (buckets.size > 5000) for (const [entryKey, value] of buckets) if (now - value.start >= windowMs) buckets.delete(entryKey);
    next();
  };
}

