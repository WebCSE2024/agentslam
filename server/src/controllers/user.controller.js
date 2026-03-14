import userModel from "../models/user.model.js";
import { sendEmail } from "../services/email.service.js";
import { onboardingEmailTemplate } from "../templates/onboardingEmail.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { USER_ROLE, USER_STATUS } from "../utils/enum.js";
import bcrypt from 'bcryptjs';
import { generatePassword } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { logInfo } from "../utils/logger.js";

const ONBOARDING_PASSWORD_LENGTH = Number(process.env.ONBOARDING_PASSWORD_LENGTH || 12);
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

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

        const plainPassword = generatePassword(ONBOARDING_PASSWORD_LENGTH);
        const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

        user.password = hashedPassword;

        try {
            await user.save();
            logInfo(`User password reset successfully. User: ${user.name || user.email}.`);
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
                subject: tpl.subject,
                text: tpl.text,
                html: tpl.html,
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

        const role = req.body?.role || USER_ROLE.USER;
        const users = await userModel.find({role}).select("-password").lean();

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

        const userId = req.params?.id || undefined;
        const username = req.body?.name || undefined;

        if(!userId && !username){
            throw new ApiError(400, "User ID or username is required");
        }

        const conditions = [];
        if(userId){
            conditions.push({ _id: userId });
        }
        if(username){
            conditions.push({ name: username });
        }
        const user = await userModel.findOne({ $or: conditions }).select("-password").lean();

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        return new ApiResponse(200, user, "User info fetched successfully");
    })

    getUsersByFilter = asyncHandler(async (req, res) => {

        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }
        const status = req.query?.status || USER_STATUS.ACTIVE;
        const role = req.query?.role || USER_ROLE.USER;
        const users = await userModel.find({ status, role }).select("-password").lean();

        return new ApiResponse(200, users, "Users fetched successfully");
    })

    changeStatus = async(input)=>{
        
        const query = {
            $or: [
                { name: input },
                ...(mongoose.Types.ObjectId.isValid(input) ? [{ _id: input }] : [])
            ]
        };

        const user = await userModel.findOne(query);

        if (!user) {
            return null;
        }

        const nextStatus = user.status === USER_STATUS.ACTIVE
            ? USER_STATUS.DISABLED
            : USER_STATUS.ACTIVE;

        user.status = nextStatus;
        await user.save();
        logInfo(`User status updated successfully. User: ${user.name || user.email}, Status: ${user.status}.`);

        return user;
    }

    changeStatusManually = asyncHandler(async (req, res) => {
        if(!req.user || req.user.role !== USER_ROLE.ADMIN){
            throw new ApiError(403, "Forbidden");
        }

        const { input } = req.body;

        if (!input) {
            throw new ApiError(400, "User ID or username is required");
        }

        const updatedUser = await this.changeStatus(input);

        if (!updatedUser) {
            throw new ApiError(404, "User not found.");
        }

        const actionMessage = updatedUser.status === USER_STATUS.DISABLED
            ? "User disabled successfully"
            : "User enabled successfully";

        return new ApiResponse(200, { status: updatedUser.status }, actionMessage);
    })

    resetUserDB = async() => {
        try {
            await userModel.deleteMany({});
            logInfo("User collection reset successfully.");
            return true;
        } catch (error) {
            console.error("Error clearing user collection:", error);
            return false;
        }
    }

    resetUsers = async() => {
        try {
            await userModel.updateMany({ role: USER_ROLE.USER }, { $set: { status: USER_STATUS.ACTIVE , tournamentPoints: 0} });
            logInfo("Tournament users reset successfully.");
            return true;
        } catch (error) {
            console.error("Error resetting user collection:", error);
            return false;
        }
    }
}

export default new UserController();