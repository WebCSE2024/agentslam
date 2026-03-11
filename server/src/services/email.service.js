import { createTransport } from "nodemailer";

const { SMTP_EMAIL, SMTP_PASS, SMTP_HOST, SMTP_PORT, EMAIL } = process.env;

const transporter = createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASS,
  },
});

// Verify connection at startup — log only, never throw (would crash via uncaughtException)
transporter.verify((error) => {
  if (error) {
    console.error("SMTP transporter error:", error.message);
  } else {
    console.log("SMTP ready");
  }
});

/**
 * Send an email.
 * @param {{ to: string, subject: string, html?: string, text?: string }} options
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    await transporter.sendMail({
      from: EMAIL || SMTP_EMAIL,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error; // re-throw so the controller can catch and return 500
  }
}
