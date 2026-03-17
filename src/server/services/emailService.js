//src/server/services/emailService.js
const nodemailer = require('nodemailer');

// Create a transporter using Brevo's SMTP (works via HTTP API)
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_SMTP_USER || process.env.BREVO_API_KEY, // Often the same as API key
    pass: process.env.BREVO_SMTP_PASS || process.env.BREVO_API_KEY,
  },
});

const APP_NAME = process.env.APP_NAME || 'BackyardBeats';
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@backyardbeats.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Generic send function
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`✅ Email sent to ${to} (subject: ${subject}) – MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Email failed:', error);
    // Log but don't throw – we don't want to break the main flow
  }
}

/**
 * Welcome email after user registration
 */
async function sendWelcomeEmail(user) {
  const html = `
    <h1>Welcome to ${APP_NAME}, ${user.username}!</h1>
    <p>Thank you for joining our community of Malawian artists and fans.</p>
    <p>Explore new music, follow your favourite artists, and stay tuned for events.</p>
    <p><a href="${FRONTEND_URL}">Visit ${APP_NAME}</a></p>
  `;
  const text = `Welcome to ${APP_NAME}, ${user.username}! Thank you for joining our community. Explore new music, follow your favourite artists, and stay tuned for events. Visit ${FRONTEND_URL}`;
  await sendEmail({ to: user.email, subject: `Welcome to ${APP_NAME}!`, html, text });
}

/**
 * Notify user that their artist profile has been approved
 */
async function sendArtistApprovalEmail(user, artist) {
  const html = `
    <h1>Your artist profile is approved!</h1>
    <p>Congratulations, ${artist.display_name}! Your profile has been approved. You can now start uploading tracks and creating events.</p>
    <p><a href="${FRONTEND_URL}/artist/dashboard">Go to your dashboard</a></p>
  `;
  const text = `Your artist profile is approved! Congratulations, ${artist.display_name}! Your profile has been approved. You can now start uploading tracks and creating events. Visit your dashboard: ${FRONTEND_URL}/artist/dashboard`;
  await sendEmail({ to: user.email, subject: 'Artist Profile Approved', html, text });
}

/**
 * Notify user that their artist profile was rejected
 */
async function sendArtistRejectionEmail(user, artist, reason) {
  const html = `
    <h1>Artist profile update</h1>
    <p>Dear ${artist.display_name}, your artist profile has been reviewed and was not approved at this time.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>You may update your profile and resubmit, or contact support if you have questions.</p>
    <p><a href="${FRONTEND_URL}/support">Contact Support</a></p>
  `;
  const text = `Artist profile update: Your artist profile has been reviewed and was not approved.${reason ? ` Reason: ${reason}` : ''} You may update your profile and resubmit, or contact support.`;
  await sendEmail({ to: user.email, subject: 'Artist Profile Status', html, text });
}

/**
 * Notify user that their track has been approved
 */
async function sendTrackApprovalEmail(user, track) {
  const html = `
    <h1>Your track "${track.title}" is approved!</h1>
    <p>Your track is now live on ${APP_NAME}. Fans can listen and download it.</p>
    <p><a href="${FRONTEND_URL}/tracks/${track.id}">View track</a></p>
  `;
  const text = `Your track "${track.title}" is approved! It's now live. View at ${FRONTEND_URL}/tracks/${track.id}`;
  await sendEmail({ to: user.email, subject: 'Track Approved', html, text });
}

/**
 * Notify user that their track was rejected
 */
async function sendTrackRejectionEmail(user, track, reason) {
  const html = `
    <h1>Track update</h1>
    <p>Your track "${track.title}" has been reviewed and was not approved.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>You may edit and resubmit, or contact support.</p>
    <p><a href="${FRONTEND_URL}/support">Contact Support</a></p>
  `;
  const text = `Track update: "${track.title}" was not approved.${reason ? ` Reason: ${reason}` : ''} You may edit and resubmit.`;
  await sendEmail({ to: user.email, subject: 'Track Status', html, text });
}

/**
 * Notify admin(s) about pending approvals
 */
async function notifyAdminsPending(itemType, itemId, itemTitle) {
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  if (adminEmails.length === 0) return;

  const html = `
    <h1>Pending Approval: New ${itemType}</h1>
    <p>A new ${itemType} requires your review:</p>
    <ul>
      <li><strong>Title:</strong> ${itemTitle}</li>
      <li><strong>ID:</strong> ${itemId}</li>
    </ul>
    <p><a href="${FRONTEND_URL}/admin/approvals">Go to Admin Dashboard</a></p>
  `;
  const text = `Pending Approval: New ${itemType} – Title: ${itemTitle}, ID: ${itemId}. Please review in the admin dashboard.`;

  for (const email of adminEmails) {
    await sendEmail({ to: email.trim(), subject: `[Admin] New ${itemType} Pending Approval`, html, text });
  }
}

module.exports = {
  sendWelcomeEmail,
  sendArtistApprovalEmail,
  sendArtistRejectionEmail,
  sendTrackApprovalEmail,
  sendTrackRejectionEmail,
  notifyAdminsPending,
};