export function validate(req, res, next) {
  const errors = req.validationErrors;
  if (errors?.length) return res.status(400).json({ message: errors[0].msg, errors });
  next();
}
