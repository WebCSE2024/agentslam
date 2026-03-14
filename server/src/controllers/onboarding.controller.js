import userModel from "../models/user.model.js";
import { sendEmail } from "../services/email.service.js";
import { onboardingEmailTemplate } from "../templates/onboardingEmail.js";
import ApiError from "../utils/apierror.js";
import ApiResponse from "../utils/apiresponse.js";
import { USER_ROLE } from "../utils/enum.js";
import bcrypt from 'bcryptjs';
import { asyncHandler } from "../utils/asyncHandler.js";
import { generatePassword } from "../utils/helpers.js";
import { signSandboxToken } from "../utils/authtoken.js";
import { logInfo } from "../utils/logger.js";

class OnboardingController{

    createUserFromPayload = async ({ role, name, email, admissionNumber }) => {

        if(process.env.NODE_ENV === "production"){if (!role || !Object.values(USER_ROLE).includes(role)) {
            throw new ApiError(400, "Invalid role");
        }
        if (!email || !admissionNumber) {
            throw new ApiError(400, "Email and admissionNumber are required");
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedAdmission = String(admissionNumber).trim();

        const existing = await userModel.findOne({
            $or: [{ email: normalizedEmail }, { admissionNumber: normalizedAdmission }],
        });

        if (existing) {
            throw new ApiError(400, "User already exists");
        }

        const plainPassword = generatePassword(12);
        const hashedPassword = await bcrypt.hash(plainPassword, 12);

        const username = normalizedAdmission.toLowerCase();

        let user;
        try {
            user = await userModel.create({
                role,
                status: "active",
                name: String(name || "").trim(),
                email: normalizedEmail,
                admissionNumber: normalizedAdmission,
                password: hashedPassword,
                tournamentPoints: 0,
            });
            logInfo(`User created successfully. User: ${user.name || user.email}, Role: ${user.role}.`);
        } catch (error) {
            throw new ApiError(500, "Failed to create user");
        }

        const sandboxToken = signSandboxToken({ userId: user._id });
        const WS_SANDBOX_BASE = process.env.WS_SANDBOX_URL || "ws://localhost:8000/ws-sandbox";
        const sandboxUrl = `${WS_SANDBOX_BASE}?payload=${sandboxToken}`;
        
        const tpl = onboardingEmailTemplate({
            name: user.name,
            email: user.email,
            admissionNumber: user.admissionNumber,
            role: user.role,
            password: plainPassword,
            sandboxUrl: sandboxUrl, // will be set below after key is stored
        })


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

        return {
            id: user._id,
            role: user.role,
            name: user.name,
            email: user.email,
            admissionNumber: user.admissionNumber,
        };
        }else{
            if (!role || !Object.values(USER_ROLE).includes(role)) {
                throw new ApiError(400, "Invalid role");
            }
            if (!email || !admissionNumber) {
                throw new ApiError(400, "Email and admissionNumber are required");
            }

            const normalizedEmail = String(email).toLowerCase().trim();
            const normalizedAdmission = String(admissionNumber).trim();

            const existing = await userModel.findOne({
                $or: [{ email: normalizedEmail }, { admissionNumber: normalizedAdmission }],
            });

            if (existing) {
                throw new ApiError(400, "User already exists");
            }

            const plainPassword = '1234';
            const hashedPassword = await bcrypt.hash(plainPassword, 12);

            const username = normalizedAdmission.toLowerCase();

            let user;
            try {
                user = await userModel.create({
                    role,
                    status: "active",
                    name: String(name || "").trim(),
                    email: normalizedEmail,
                    admissionNumber: normalizedAdmission,
                    password: hashedPassword,
                    tournamentPoints: 0,
                });
                logInfo(`User created successfully. User: ${user.name || user.email}, Role: ${user.role}.`);
            } catch (error) {
                throw new ApiError(500, "Failed to create user");
            }

            const sandboxToken = signSandboxToken({ userId: user._id });
            const WS_SANDBOX_BASE = process.env.WS_SANDBOX_URL || "ws://localhost:8000/ws-sandbox";
            const sandboxUrl = `${WS_SANDBOX_BASE}?payload=${sandboxToken}`;
            logInfo(`Sandbox URL generated successfully for user ${user.name || user.email}.`);

            return {
                id: user._id,
                role: user.role,
                name: user.name,
                email: user.email,
                admissionNumber: user.admissionNumber,
            };
        }
    }

    createUser = asyncHandler(async (req, res) => {

        const { role, name, email, admissionNumber } = req.body;

        const newUser = await this.createUserFromPayload({
            role,
            name,
            email,
            admissionNumber,
        });

        return new ApiResponse(201, newUser, "User created successfully");
    })

    createUsersBatch = asyncHandler(async (req, res) => {
        const users = Array.isArray(req.body?.users) ? req.body.users : [];

        if (!users.length) {
            throw new ApiError(400, "User Array is Required")
        }

        const results = [];
        let failed = 0;

        for (const entry of users) {
            try {
                const result = await this.createUserFromPayload(entry || {});
                results.push(result);
            } catch (err) {
                failed += 1;
                const userInfo = {
                    name: entry?.name,
                    email: entry?.email,
                    role: entry?.role,
                    admissionNumber: entry?.admissionNumber,
                };
                console.error("Onboarding batch error:", userInfo, err);
            }
        }

        return new ApiResponse(201, {
            created: results.length,
            failed,
            users: results,
        }, "Users batch processed successfully");
    })
 
}

export default new OnboardingController()