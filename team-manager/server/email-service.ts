import nodemailer from 'nodemailer';

/**
 * Send an invitation email using SMTP, falling back to console logging if SMTP is not configured.
 */
export async function sendInvitationEmail(
  toEmail: string,
  token: string,
  teamName: string,
  inviterName: string
): Promise<boolean> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;
  
  const mailSubject = `You've been invited to join the team "${teamName}" on TeamMgr`;
  const mailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">You've been invited!</h2>
      <p style="color: #334155; font-size: 16px; line-height: 24px;">
        Hello,
      </p>
      <p style="color: #334155; font-size: 16px; line-height: 24px;">
        <strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong> on TeamMgr.
      </p>
      <div style="margin: 24px 0;">
        <a href="${acceptUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Or copy and paste this link into your browser:<br/>
        <a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;"/>
      <p style="color: #94a3b8; font-size: 12px;">
        This invitation link will expire in 7 days. If you were not expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  const mailText = `
Hello,

${inviterName} has invited you to join the team "${teamName}" on TeamMgr.

To accept this invitation, please open the following link in your browser:
${acceptUrl}

This invitation link will expire in 7 days. If you were not expecting this invitation, you can safely ignore this email.
`;

  // Read SMTP configurations from environment
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"TeamMgr" <invitations@teammgr.local>';

  if (host) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: mailSubject,
        text: mailText,
        html: mailHtml,
      });

      console.log(`[Email] 📧 Invitation email sent successfully to ${toEmail} via SMTP`);
      return true;
    } catch (error) {
      console.error(`[Email] ❌ Failed to send invitation email via SMTP to ${toEmail}:`, error);
    }
  }

  // Fallback / Log to console in development
  console.log(`
================================================================================
📧 [MOCK EMAIL] INVITATION TO JOIN "${teamName.toUpperCase()}"
================================================================================
To:      ${toEmail}
From:    ${from}
Subject: ${mailSubject}
--------------------------------------------------------------------------------
${mailText.trim()}
--------------------------------------------------------------------------------
👉 JOIN LINK: ${acceptUrl}
================================================================================
`);
  return true;
}
