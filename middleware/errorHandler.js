export function notFound(req, res, next) { res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }); }

export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Profile photos must be 5 MB or smaller.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'A record with that value already exists' });
  const status = err.statusCode || 500;
  res.status(status).json({ message: status === 500 ? 'Internal server error' : err.message });
}
