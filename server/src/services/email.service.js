import { createTransport } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const { SMTP_EMAIL, SMTP_PASS, SMTP_HOST, SMTP_PORT,EMAIL } = process.env;

const transporter = createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    throw error;
  } else {
    console.log("Ready for message");
  }
});

export async function sendEmail(toEmail, subject, text, verificationcCode) {
  try {
    await transporter.sendMail({
      from: EMAIL,
      to: toEmail,
      subject: subject,
      text: verificationcCode ? `${text}  ${verificationcCode}.` : text,
      html: undefined,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export async function sendEmailHtml({ to, subject, text, html }) {
  try {
    await transporter.sendMail({
      from: EMAIL,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
