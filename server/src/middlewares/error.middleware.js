import ApiError from "../utils/apierror";

const isProd = process.env.NODE_ENV === "production";

/**
 * Normalise any thrown value into a well-shaped ApiError so the
 * response handler below always has a consistent object to work with.
 */
const toApiError = (err) => {

    // Already an ApiError — use as-is
    if (err instanceof ApiError) return err;

    // Mongoose validation error  (e.g. required field missing)
    if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((e) => e.message);
        return new ApiError(400, "Validation failed", err.stack, errors);
    }

    // Mongoose duplicate key  (e.g. unique index violation)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] ?? "field";
        return new ApiError(409, `Duplicate value for '${field}'`, err.stack);
    }

    // Mongoose bad ObjectId  (e.g. malformed :id param)
    if (err.name === "CastError") {
        return new ApiError(400, `Invalid value for '${err.path}'`, err.stack);
    }

    // JWT errors (shouldn't normally escape authMiddleware, but just in case)
    if (err.name === "JsonWebTokenError") {
        return new ApiError(401, "Invalid token", err.stack);
    }
    if (err.name === "TokenExpiredError") {
        return new ApiError(401, "Token expired", err.stack);
    }

    // Unknown — wrap as 500
    return new ApiError(
        err.statusCode || err.status || 500,
        err.message || "Internal server error",
        err.stack
    );
};

/**
 * Global Express error handler.
 * Must be registered LAST in the middleware chain (after all routes).
 * Express identifies it as an error handler via the 4-argument signature.
 */
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars

    const apiError = toApiError(err);

    // Always log server-side for observability
    if (apiError.statusCode >= 500) {
        console.error(`[${req.method}] ${req.originalUrl} — ${apiError.statusCode}`, err);
    }

    return res.status(apiError.statusCode).json({
        success: false,
        message: apiError.message,
        errors: apiError.errors?.length ? apiError.errors : undefined,
        // Expose stack trace only in development
        ...(isProd ? {} : { stack: apiError.stack }),
    });
};

/**
 * 404 handler — must be registered AFTER all routes but BEFORE errorHandler.
 */
export const notFoundHandler = (req, res, next) => {
    next(new ApiError(404, `Route '${req.method} ${req.originalUrl}' not found`));
};
