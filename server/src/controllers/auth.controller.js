import userModel from "../models/user.model";
import { asyncHandler } from "../utils/asyncHandler";
import ApiError from "../utils/apierror";
import ApiResponse from "../utils/apiresponse";
import bcrypt from 'bcryptjs'
import { generateSessionId, signAccessToken, signRefreshToken, verifyToken, getCookieOptions } from "../utils/authtoken";
import redisClient from "../configs/redis.config";
import { userSessionKey } from "../utils/rediskeys";

class AuthController{

    SESSION_TTL_SECONDS = Number(
        process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7
    )

    cleanUpCookie = (res) => {
        return res
            .clearCookie("accessToken", getCookieOptions({httpOnly: true}))
            .clearCookie("refreshToken", getCookieOptions({httpOnly: true}))
    };

    revokeSessionByUserId = async(userId) => {
        await redisClient.del(userSessionKey(userId));
    }

    login = asyncHandler(async(req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, "Email and password are required");
        }

        const user = await userModel.findOne({ email: String(email).toLowerCase() });
        if (!user) {
            throw new ApiError(400, "Invalid credentials");
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            throw new ApiError(400, "Invalid Password");
        }

        // Single-session semantics: new login revokes old session immediately.
        await this.revokeSessionByUserId(user._id.toString());

        const sid = generateSessionId();

        await redisClient.set(userSessionKey(user._id.toString()), sid, {
            EX: this.SESSION_TTL_SECONDS,
        });

        const accessToken = signAccessToken({
            userId: user._id.toString(),
            sid,
            role: user.role,
            username: user.username,
            email: user.email,
        });

        const refreshToken = signRefreshToken({
            userId: user._id.toString(),
            sid,
        });

        res.cookie(
            "access_token",
            accessToken,
            getCookieOptions({ httpOnly: true })
        );
        res.cookie(
            "refresh_token",
            refreshToken,
            getCookieOptions({ httpOnly: true })
        );

        return new ApiResponse(200, {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.name,
                admissionNumber: user.admissionNumber,
            }
        }, "User logged in Successfully")
    })

    me = asyncHandler(async(req, res)=>{

        if(!req.user.id){
            throw new ApiError(400, "User ID is Required")
        }
        const user = await userModel.findById(req.user.id).select("-password");
        if (!user) throw new ApiError(400, "User not found");
        return new ApiResponse(200, user, "User Fetched")
    })

    logout = asyncHandler(async(req, res)=>{

        const accessToken = req.cookies?.access_token
        const refreshToken = req.cookies?.refresh_token

        let userId = null;

        if (accessToken) {
            const decoded = verifyToken(accessToken);
            userId = decoded.sub;
        } else if (refreshToken) {
            const decoded = verifyToken(refreshToken);
            userId = decoded.sub;
        }

        if (userId) {
            await this.revokeSessionByUserId(String(userId));
        }

        this.cleanUpCookie(res);

        return new ApiResponse(200, null, "Logout Successfully.");
    })

}

export const authController = new AuthController()