export function onboardingEmailTemplate({
  name,
  email,
  admissionNumber,
  password,
  role,
}) {
  const safeName = name || email;
  const primaryColor = "#0f172a";
  const borderColor = "#e5e7eb";
  const lightBg = "#f8fafc";
  const tableStyle = `width: 100%; border-collapse: collapse; border: 1px solid ${borderColor}; font-size: 14px;`;
  const thStyle = `background-color: ${lightBg}; border: 1px solid ${borderColor}; padding: 8px; text-align: left; font-weight: bold;`;
  const tdStyle = `border: 1px solid ${borderColor}; padding: 8px;`;
  return {
    subject: "Agglomeration 2.0 Account Credentials",
    text: `Hello ${safeName},\n\nYour ${role} account has been created for Agglomeration.\n\nTeam Name: ${safeName}\nRole: ${role}\nEmail: ${email}\n\nPlease keep your login credentials secure.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; line-height: 1.5;">
        <h2 style="color: ${primaryColor}; margin: 0 0 6px 0;">Agglomeration 2.0 Account Created</h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569;">Your Team onboarding details</p>

        <table style="${tableStyle}">
          <tr>
            <th style="${thStyle}">Team Name</th>
            <th style="${thStyle}">Team ID</th>
            <th style="${thStyle}">Login Email</th>
            <th style="${thStyle}">Password</th>
          </tr>
          <tr>
            <td style="${tdStyle}"><strong>${safeName}</strong></td>
            <td style="${tdStyle}"><strong>${admissionNumber}</strong></td>
            <td style="${tdStyle}">${email}</td>
            <td style="${tdStyle}"><strong>${password}</strong></td>
          </tr>
        </table>

        <div style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid ${borderColor}; padding-top: 10px;">
          Keep your login credentials secure. Do not share them.
        </div>

        <p style="margin: 12px 0 0 0; font-size: 13px;">
          Website: <a href="https://agglomeration-la57.onrender.com" style="color: ${primaryColor}; text-decoration: none;">https://agglomeration-la57.onrender.com</a>
        </p>

        <div style="margin-top: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em;">Sponsors</p>
          <div style="display: block;">
            <img src="https://res.cloudinary.com/dznhfdvrn/image/upload/v1769074673/iit-ism_aniwql.png" alt="CSE Batch'10" style="height: 28px; display: inline-block; margin-right: 10px; margin-bottom: 8px;" />
            <img src="https://res.cloudinary.com/dznhfdvrn/image/upload/v1769074673/icici_qvyky8.jpg" alt="ICICI Bank" style="height: 28px; display: inline-block; margin-right: 10px; margin-bottom: 8px;" />
            <img src="https://res.cloudinary.com/dznhfdvrn/image/upload/v1769074673/apparent_hz77uq.png" alt="Apparent Energy" style="height: 28px; display: inline-block; margin-right: 10px; margin-bottom: 8px;" />
            <img src="https://res.cloudinary.com/dznhfdvrn/image/upload/v1769074672/incresol_vcxfl3.jpg" alt="Incresol" style="height: 28px; display: inline-block; margin-right: 0; margin-bottom: 8px;" />
          </div>
        </div>
      </div>
    `.trim(),
  };
}
