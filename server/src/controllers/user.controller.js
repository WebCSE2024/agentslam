import userModel from "../models/user.model.js";
import { sendEmail } from "../services/email.service.js";
import { onboardingEmailTemplate } from "../templates/onboardingEmail.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { USER_ROLE, USER_STATUS } from "../utils/enum.js";
import bcrypt from 'bcryptjs';
import { generatePassword } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

class UserController{

    resetPassword = asyncHandler(async (req, res) => {
        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }

        const { email } = req.body;
        
        if (!email) {
            throw new ApiError(400, "Email is required");
        }

        const normalizedEmail = String(email).toLowerCase().trim();

        const user = await userModel.findOne({ email: normalizedEmail });
        
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const plainPassword = generatePassword(12);
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        user.password = hashedPassword;

        try {
            await user.save();
        } catch (error) {
            throw new ApiError(500, "Failed to reset password");
        }

        const tpl = onboardingEmailTemplate({
            name: user.name,
            email: user.email,
            admissionNumber: user.admissionNumber,
            role: user.role,
            password: plainPassword,
        });

        try {
            await sendEmail({
                to: user.email,
                subject: "Your password has been reset",
                html: tpl,
            });
        } catch (error) {
            throw new ApiError(500, "Failed to send email");
        }

        return new ApiResponse(200, null, "Password reset successfully");
    })

    getAllUsers = asyncHandler(async (req, res) => {

        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }

        const {role} = req.body || USER_ROLE.USER;

        const users = await userModel.find({ role }).select("-password").lean();

        return new ApiResponse(200, users, "Users fetched successfully");
    })

    getUserProfile = asyncHandler(async (req, res) => {
        const userId = req.user._id;

        const user = await userModel.findById(userId).select("-password").lean();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        return new ApiResponse(200, user, "User profile fetched successfully");
    })

    getUserInfo = asyncHandler(async (req, res) => {

        const userId = req.params.id;
        const username = req.body.username;

        const user = await userModel.findOne({ $or: [{ _id: userId }, { username }] }).select("-password").lean();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        return new ApiResponse(200, user, "User info fetched successfully");
    })

    getUsersByStatus = asyncHandler(async (req, res) => {

        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }
        const { status } = req.body || USER_STATUS.ACTIVE;

        const users = await userModel.find({ status }).select("-password").lean();

        return new ApiResponse(200, users, "Users fetched successfully");
    })
}

export default new UserController();