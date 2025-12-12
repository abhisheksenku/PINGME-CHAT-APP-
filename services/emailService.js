// ==================
// == DEPENDENCIES ==
// ==================

// Imports and runs the 'dotenv' configuration.
// This loads all variables from your .env file (like MAIL and MAIL_PASSWORD)
// into the 'process.env' object, making them available in this file.
require("dotenv").config();

// --- Debugging ---
// These logs are helpful to confirm that the .env file was loaded correctly.
// Make sure 'MAIL' and 'MAIL_PASSWORD' are spelled exactly the same in your .env file.
console.log("MAIL:", process.env.MAIL);
console.log("MAIL_PASSWORD:", process.env.MAIL_PASSWORD);
// ---------------

// Imports the Nodemailer library, which is the main tool for sending emails from Node.js.
const nodeMailer = require("nodemailer");

// ==================
// == CONFIGURATION ==
// ==================

// Creates a reusable 'transporter' object. This is the "mail truck"
// that knows *how* to connect to your email provider (Gmail) and send mail.
const transporter = nodeMailer.createTransport({
  // secure: true -> Use SSL/TLS encryption (required for port 465).
  secure: true,
  // host: 'smtp.gmail.com' -> The server address for Gmail's mail service.
  host: "smtp.gmail.com",
  // port: 465 -> The standard SSL port for SMTP (email sending).
  port: 465,
  // auth: -> The login credentials for your Gmail account.
  auth: {
    // user: process.env.MAIL -> Your full Gmail address (e.g., "you@gmail.com").
    // This MUST be the email address you are sending *from*.
    user: process.env.MAIL,
    // pass: process.env.MAIL_PASSWORD -> Your Gmail "App Password".
    // (Note: This is NOT your regular Gmail password. It's a special 16-digit
    // password you generate in your Google Account security settings).
    pass: process.env.MAIL_PASSWORD,
  },
});

// ==================
// == MAIN FUNCTION ==
// ==================

/**
 * An asynchronous function that sends an email.
 * This function can be imported and reused anywhere in the app (like authController).
 *
 * @param {object} options - An object containing the email details.
 * @param {string} options.toEmail - The recipient's email address.
 * @param {string} options.subject - The subject line of the email.
 * @param {string} options.html - The HTML version of the email body (for modern clients).
 * @param {string} options.text - The plain text version of the email body (for older clients).
 */
async function sendMail({ toEmail, subject, html, text }) {
  try {
    // --- 1. Send the Email ---
    // Tell the 'transporter' (our mail truck) to send the mail with these details.
    // We 'await' this, as it's an asynchronous network operation.
    const info = await transporter.sendMail({
      from: process.env.MAIL, // The sender (must be the same as your auth user).
      to: toEmail, // The recipient.
      subject: subject, // The subject line.
      html: html, // The HTML body.
      text: text, // The plain text fallback.
    });

    // --- 2. Log Success ---
    // If the email sends successfully, log the server's response.
    console.log("Email sent:", info.response);
    return info; // Return the success information.
  } catch (err) {
    // --- 3. Log Error ---
    // If 'transporter.sendMail' fails (e.g., wrong password, no connection),
    // this 'catch' block will run.
    console.error("Email error:", err);
    throw err; // Re-throw the error so the function that called sendMail
    // (e.g., requestPasswordReset) knows that it failed.
  }
}

// ==================
// == EXPORTS ==
// ==================

// Exports the 'sendMail' function so it can be imported and used in other
// files (like your authController).
module.exports = { sendMail };