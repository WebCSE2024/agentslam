import { createTransport } from "nodemailer";
import { logInfo } from "../utils/logger.js";
// const { SMTP_EMAIL, SMTP_PASS, SMTP_HOST, SMTP_PORT, EMAIL } = process.env;

const SMTP_HOST = process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io";
const SMTP_PORT = Number(process.env.SMTP_PORT || 2525);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL=process.env.EMAIL || "webcseiitism@gmail.com"

var transporter = createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  }
});

// const transporter = createTransport({
//   host: SMTP_HOST,
//   port: Number(SMTP_PORT) || 587,
//   secure: false,
//   auth: {
//     user: SMTP_EMAIL,
//     pass: SMTP_PASS,
//   },
// });

// Verify connection at startup — log only, never throw (would crash via uncaughtException)
transporter.verify((error) => {
  if (error) {
    console.error("SMTP transporter error:", error.message);
  } else {
    logInfo("SMTP transporter verified successfully.");
  }
});

/**
 * Send an email.
 * @param {{ to: string, subject: string, html?: string, text?: string }} options
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    await transporter.sendMail({
      from: EMAIL,
      to,
      subject,
      text,
      html,
    });
    logInfo(`Email sent successfully to ${to}.`);
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error; // re-throw so the controller can catch and return 500
  }
}
