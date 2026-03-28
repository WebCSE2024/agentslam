/**
 * Match activation / login-link email template.
 * @param {{
 *   recipientName: string,
 *   team1Name: string,
 *   team2Name: string,
 *   wsUrl: string,       — full ws:// URL including matchId + passkey query params
 * }} params
 */
export function matchUpdateEmailTemplate({ recipientName, team1Name, team2Name, wsUrl, yourTeam }) {
  const primaryColor = "#0f172a";
  const borderColor  = "#e5e7eb";
  const accentColor  = "#2563eb";

  return {
    subject: "AgentSlam - Match Update",
    text:
      `Greetings AgentSlam Team!\n\n` +
      `Your upcoming match: ${team1Name} vs ${team2Name}\n\n` +
      `Here is your login link for the next match:\n${wsUrl}\n\n` +
      `All the best!!\n\n— AgentSlam Team`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; line-height: 1.6;">
        <h2 style="color: ${primaryColor}; margin: 0 0 4px 0;">AgentSlam — Match Update</h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b;">Your next match is ready</p>

        <p style="margin: 0 0 12px 0; font-size: 15px;">
          Greetings from <strong>AgentSlam Team</strong>!
        </p>

        <p style="margin: 0 0 8px 0; font-size: 14px;">
          Your upcoming match:
        </p>
        <div style="padding: 12px 16px; background-color: #f8fafc; border: 1px solid ${borderColor}; border-radius: 6px; text-align: center; font-size: 17px; font-weight: bold; letter-spacing: 0.02em; margin-bottom: 20px;">
          ${team1Name} &nbsp;vs&nbsp; ${team2Name}
        </div>

        <p style="margin: 0 0 8px 0; font-size: 14px;">
          Here is your login link for the next match:
        </p>
        <div style="padding: 12px 16px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; word-break: break-all; margin-bottom: 20px;">
          <a href="${wsUrl}" style="color: ${accentColor}; font-size: 13px; text-decoration: none;">${wsUrl}</a>
        </div>
        <p style="margin: 0 0 8px 0; font-size: 14px;"> You are ${yourTeam}!</p>
        <p style="margin: 0 0 20px 0; font-size: 15px; font-weight: bold;">All the best!! 🚀</p>

        <div style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid ${borderColor}; padding-top: 12px;">
          <p style="margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.08em;">Sponsors</p>
          <div>
            <img src="https://res.cloudinary.com/dyyi2bb0d/image/upload/v1774692795/csesociety_lquzqd.png" alt="CSE Society" style="height: 28px; display: inline-block; margin-right: 10px; margin-bottom: 6px;" />
            <img src="https://res.cloudinary.com/dznhfdvrn/image/upload/v1769074672/incresol_vcxfl3.jpg" alt="Incresol" style="height: 28px; display: inline-block; margin-right: 0; margin-bottom: 6px;" />
          </div>
        </div>
      </div>
    `.trim(),
  };
}
