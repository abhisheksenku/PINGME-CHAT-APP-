// ==================
// == DEPENDENCIES ==
// ==================

// Imports the bcrypt library, used for securely hashing and comparing passwords.
const bcrypt = require("bcrypt");

// Imports the main Sequelize database connection instance from the utilities folder.
const sequelize = require("../utilities/sql");

// Defines the "cost factor" or salt rounds for bcrypt.
// 10 is a strong, standard balance between security and performance.
const saltRounds = 10;

// Imports the jsonwebtoken library, used for creating and verifying JWTs (access tokens).
const jwt = require("jsonwebtoken");

// Imports the 'Op' (Operators) object from Sequelize for writing complex queries
// (e.g., Op.gt for "greater than", Op.or for "or").
const { Op } = require("sequelize");

// Imports the v4 function from the uuid library and renames it to uuidv4.
// This is used for generating unique random strings, perfect for reset tokens.
const { v4: uuidv4 } = require("uuid");

// Imports your custom 'sendMail' function from your email service.
const { sendMail } = require("../services/emailService");

// Imports the Sequelize 'User' model, which represents the 'users' table.
const User = require("../models/users");

// ======================
// == HELPER FUNCTIONS ==
// ======================

/**
 * Generates a new JSON Web Token (JWT) for an authenticated user.
 * This is a helper function used internally by the login controller.
 *
 * @param {object} loggeduser - The Sequelize User object (or a plain object) of the authenticated user.
 * @returns {string} A signed JWT string.
 */
const generateAccessToken = (loggeduser) => {
  // --- 1. Define the Payload ---
  // The payload is the non-sensitive data we want to store inside the token.
  // This data can be read by anyone, but it cannot be tampered with.
  const payload = {
    user: {
      id: loggeduser.id, // The user's unique ID.
      role: loggeduser.role, // User's role (e.g., 'admin', 'user') for authorization.
    },
  };

  // --- 2. Sign and Return the Token ---
  // jwt.sign() creates the token string.
  // It takes:
  // 1. The payload (our data).
  // 2. The secret key (stored in environment variables). This proves we created the token.
  // 3. Options, like the expiration time.
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h", // The token will be valid for 1 hour.
  });
};
/**
 * Controller function to handle new user registration (Sign Up).
 * It validates input, checks for existing users, hashes the password,
 * and creates a new user within a database transaction.
 *
 * Route: POST /api/auth/signup
 */
const postUsers = async (req, res) => {
  // Start a new database transaction. This ensures that if any
  // part of the process fails, all database changes are rolled back,
  // preventing partial data (e.g., a user created without a profile).
  const t = await sequelize.transaction();

  try {
    // --- 1. Data Extraction & Validation ---
    // Destructure the required fields from the request body.
    const { name, email, phone, password } = req.body;

    // Check if any of the required fields are missing.
    if (!name || !email || !phone || !password) {
      // If validation fails, roll back the transaction (even though nothing happened yet)
      await t.rollback();
      // Send a 400 Bad Request response.
      return res.status(400).json({
        message:
          "Validation error: Please provide name, email, phone, and password.",
      });
    }

    // --- 2. Check for Existing User ---
    // Check if a user with this email already exists in the database.
    // We pass the transaction 't' to this query.
    const existingUser = await User.findOne({
      where: { email },
      transaction: t,
    });

    // If a user is found, the email is already taken.
    if (existingUser) {
      // Roll back the transaction.
      await t.rollback();
      // Send a 409 Conflict response.
      return res.status(409).json({
        message: "A user with this email address already exists",
      });
    }

    // --- 3. Password Hashing ---
    // Hash the plain-text password using bcrypt.
    // This is a one-way hash; the original password cannot be recovered.
    // 'saltRounds' controls the hashing strength (e.g., 10).
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // --- 4. Create New User ---
    // Create the new user record in the User table.
    // We store the 'hashedPassword', not the original one.
    const newUser = await User.create(
      {
        name,
        email,
        phone,
        password: hashedPassword,
      },
      { transaction: t } // Ensure this operation is part of the transaction.
    );

    // --- 5. Commit Transaction ---
    // If all steps above were successful without errors,
    // permanently save all changes to the database.
    await t.commit();

    // Send a 201 Created response, indicating success.
    // Include the newly created user (minus the password) in the response.
    res.status(201).json({
      message: "User registered successfully",
      // You might want to filter out the password before sending:
      // user: { id: newUser.id, name: newUser.name, email: newUser.email }
      user: newUser,
    });
  } catch (error) {
    // --- 6. Error Handling ---
    // If any error occurred in the 'try' block (database error, etc.),
    // this 'catch' block will run.

    // Roll back all changes made during this transaction.
    await t.rollback();

    // Log the error for debugging purposes (optional but recommended).
    console.error("Error during user signup:", error);

    // Send a 500 Internal Server Error response.
    res.status(500).json({
      message: "An internal server error occurred",
    });
  }
};
/**
 * Controller function to handle existing user login.
 * It validates credentials, compares the password using bcrypt,
 * and issues a JSON Web Token (JWT) on success.
 *
 * Route: POST /api/auth/login
 */
const loginUser = async (req, res) => {
  try {
    // --- 1. Get Credentials ---
    // Destructure email and password from the request body.
    const { email, password } = req.body;

    // --- 2. Find User ---
    // Find a user in the database whose email matches the one provided.
    const loggeduser = await User.findOne({ where: { email } });

    // --- 3. Validation: User Exists ---
    // If no user is found with that email, return a 401 Unauthorized error.
    // We send a generic "Invalid credentials" message for security to prevent
    // "user enumeration" (letting attackers know which emails are registered).
    if (!loggeduser) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // --- 4. Validation: Password Match ---
    // Use bcrypt.compare to securely compare the plain-text 'password' from the
    // request with the 'loggeduser.password' (the hashed password) from the database.
    const isPasswordValid = await bcrypt.compare(password, loggeduser.password);

    // If the passwords do not match, return the same generic 401 error.
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // --- 5. Authentication Successful: Generate Token ---
    // If we reach this point, the user is authenticated.
    // We generate a JWT, which is a secure string that proves who they are.
    // (This 'generateAccessToken' function must be imported from another file).
    const token = generateAccessToken(loggeduser);
    await User.update({ isOnline: true }, { where: { id: loggeduser.id } });
    // --- 6. Send Response ---
    // Send a 200 OK response back to the client.
    res
      .status(200)
      // We also set the token as a cookie for web browsers.
      .cookie("token", token, {
        // httpOnly: true -> The cookie cannot be accessed by client-side JavaScript,
        // which is a crucial security measure against XSS (Cross-Site Scripting) attacks.
        httpOnly: true,
        
        // secure: true -> (Set this in production) Ensures the cookie is only sent over HTTPS.
        secure: false,
        
        // sameSite: 'strict' -> A strong defense against CSRF (Cross-Site Request Forgery) attacks.
        // It means the cookie will only be sent for requests originating from the same site.
        sameSite: "strict",
      })
      // Finally, send a JSON payload in the response body.
      .json({
        message: "Login successful",
        // We send the token in the body as well, so mobile apps or
        // client-side code (using sessionStorage) can store it manually.
        token,
        // We send the user's data back (you might want to strip the password here).
        user: loggeduser,
      });
  } catch (error) {
    // --- 7. Error Handling ---
    // If any unexpected error occurs (e.g., database connection failure),
    // this 'catch' block will run.
    console.error("Login Error:", error); // Log the full error for debugging.
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Controller function to handle a "Forgot Password" request.
 * It generates a unique, single-use token, saves it to the user's record,
 * and sends a password reset link to their email.
 *
 * Route: POST /api/auth/forgot-password
 */
const requestPasswordReset = async (req, res) => {
  // --- 1. Get Email ---
  const { email } = req.body;

  // --- 2. Validation ---
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // --- 3. Find User ---
    const user = await User.findOne({ where: { email } });

    // --- 4. Security Check (Crucial) ---
    // If no user is found with that email, we DO NOT send a 404.
    // We send a generic 200 OK response. This prevents "user enumeration,"
    // where an attacker could use this form to find out which emails
    // are registered in the system.
    if (!user) {
      return res
        .status(200)
        .json({ message: "If this email exists, a reset link has been sent." });
    }

    // --- 5. Generate Token & Expiry ---
    // Create a cryptographically strong, unique token.
    const token = uuidv4();
    // Set an expiry time for the token (e.g., 15 minutes from now).
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    // --- 6. Save Token to Database ---
    // Save the token and its expiry time to the user's record.
    // The 'updatenewPassword' function will later look for this token.
    await user.update({
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    // --- 7. Create Reset Link ---
    // Construct the full URL the user will click in their email.
    // It points to your frontend's "reset password" page.
    const resetLink = `${
      process.env.BASE_URL || "http://localhost:3000"
    }/reset-password/${token}`;

    // --- 8. Send the Reset Email ---
    // This inner try...catch block is important. It separates email
    // sending failures from database failures.
    try {
      await sendMail({
        toEmail: email, // The user's email
        subject: "Reset your password",
        // HTML content for email clients that support it
        html: `<p>Hello,</p>
               <p>You requested a password reset. Click the link below:</p>
               <a href="${resetLink}">Reset Password</a>
               <p>This link will expire in 15 minutes.</p>`,
        // Plain text fallback
        text: `Visit the following link to reset your password: ${resetLink}`,
      });
    } catch (err) {
      // If the email fails to send, log the error and tell the user.
      console.error("Email sending failed:", err);
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    // --- 9. Send Final Success Response ---
    // Send the same generic message as in Step 4 for security.
    // The user is told to check their email.
    res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent." });
  } catch (err) {
    // --- 10. Main Error Handling ---
    // Catches any database errors (e.g., user.update() failing).
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
/**
 * Controller function to handle the final password reset.
 * It validates the token provided in the URL and updates the user's password.
 *
 * Route: POST /api/auth/reset-password/:token
 */
const updatenewPassword = async (req, res) => {
  // --- 1. Get Data ---
  // Get the token from the URL parameters (e.g., /reset-password/abc123xyz)
  const { token } = req.params;
  // Get the new passwords from the request body.
  const { newPassword, confirmPassword } = req.body;

  // --- 2. Input Validation ---
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }
  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    // --- 3. Find User & Validate Token ---
    // Find a user in the database who meets BOTH conditions:
    // 1. Their 'resetToken' matches the one from the URL.
    // 2. Their 'resetTokenExpiry' is still in the future (greater than now).
    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() }, // [Op.gt] means "Greater Than"
      },
    });

    // If no user is found, it means the token is either wrong or has expired.
    if (!user) {
      return res
        .status(400)
        .json({ error: "Token expired or invalid" });
    }

    // --- 4. Hash New Password ---
    // Securely hash the new password before saving it.
    const hashedPassword = await bcrypt.hash(newPassword, 10); // 10 salt rounds

    // --- 5. Update User Record ---
    // Update the user's record in the database with two changes:
    // 1. Set the 'password' to the new hashed password.
    // 2. Nullify the 'resetToken' and 'resetTokenExpiry' fields.
    // This is a crucial security step to ensure the token cannot be used again.
    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    // --- 6. Send Success Response ---
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    // --- 7. Error Handling ---
    // Catches any database or other unexpected errors.
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports ={
    postUsers,
    loginUser,
    requestPasswordReset,
    updatenewPassword
}