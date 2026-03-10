import ApiError from "./apierror"

export const asyncHandler = async (fn) =>{

    return async (req, res, next) => {
        try {
            const response = await fn(req,res,next)
            return response
        } catch (error) {  
            next(error)
        }
    }
}