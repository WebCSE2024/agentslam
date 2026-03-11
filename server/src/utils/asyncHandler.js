export const asyncHandler = (fn) =>{

    return async (req, res, next) => {
        try {
            const response = await fn(req,res,next)
            return res.status(response.statusCode || 200).json({
                success: response.success || true,
                data: response.data || null,
                message: response.message || null,
            })
        } catch (error) {  
            next(error)
        }
    }
}