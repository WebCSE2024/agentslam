/**
 * Match result email template.
 * @param {{
 *   recipientName: string,
 *   team1Name: string,
 *   team2Name: string,
 *   scoreTeam1: number,
 *   scoreTeam2: number,
 *   winnerName: string,
 * }} params
 */
export function matchResultEmailTemplate({
  recipientName,
  team1Name,
  team2Name,
  scoreTeam1,
  scoreTeam2,
  winnerName,
}) {
  const primaryColor = "#0f172a";
  const borderColor = "#e5e7eb";
  const lightBg = "#f8fafc";
  const winnerColor = "#16a34a";
  const tableStyle = `width: 100%; border-collapse: collapse; border: 1px solid ${borderColor}; font-size: 14px;`;
  const thStyle = `background-color: ${lightBg}; border: 1px solid ${borderColor}; padding: 10px 12px; text-align: left; font-weight: bold; color: #374151;`;
  const tdStyle = `border: 1px solid ${borderColor}; padding: 10px 12px;`;

  return {
    subject: "AgentSlam Match Result",
    text:
      `Dear ${recipientName},\n\n` +
      `Here is the Result for Your recent match.\n\n` +
      `${team1Name} vs ${team2Name}\n\n` +
      `Score:\n` +
      `${team1Name}: ${scoreTeam1}\n` +
      `${team2Name}: ${scoreTeam2}\n\n` +
      `Winner: ${winnerName}\n\n` +
      `Thank you! For your participation.\n\n` +
      `— AgentSlam Team`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; line-height: 1.6;">
        <h2 style="color: ${primaryColor}; margin: 0 0 4px 0;">AgentSlam Match Result</h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b;">Official result for your recent debate match</p>

        <p style="margin: 0 0 16px 0; font-size: 15px;">
          Dear <strong>${recipientName}</strong>,<br/>
          Here is the result for your recent match.
        </p>

        <h3 style="margin: 0 0 10px 0; color: ${primaryColor}; font-size: 16px; text-align: center;">
          ${team1Name} &nbsp;vs&nbsp; ${team2Name}
        </h3>

        <table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thStyle}">Team</th>
              <th style="${thStyle}">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="${tdStyle}">${team1Name}</td>
              <td style="${tdStyle}"><strong>${scoreTeam1}</strong></td>
            </tr>
            <tr>
              <td style="${tdStyle}">${team2Name}</td>
              <td style="${tdStyle}"><strong>${scoreTeam2}</strong></td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 16px; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
          <span style="font-size: 14px; color: #166534;">🏆 Winner: </span>
          <strong style="font-size: 15px; color: ${winnerColor};">${winnerName}</strong>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 14px; color: #374151;">
          Thank you! For your participation.
        </p>

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
