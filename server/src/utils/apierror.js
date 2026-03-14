class ApiError extends Error{
    constructor(statusCode, message = "Something Went Wrong!", stack = "", errors = []){
        super(message)
        this.statusCode = statusCode
        this.errors = errors
        this.success = false

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }

        if(statusCode>=500)logInfo(`Server error occurred: ${message}`, `Stack: ${this.stack}`);
    }
}

export default ApiError