const { validationResult } = require('express-validator');

/**
 * Runs express-validator checks and returns 422 if any fail.
 * Pass this after your validation chain in a route array.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

module.exports = validate;
