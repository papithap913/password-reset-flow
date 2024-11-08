const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const router = express.Router();

// Set up nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Request password reset
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).send('User not found.');

  user.resetToken = uuidv4();
  user.resetTokenExpiration = Date.now() + 3600000; // Token valid for 1 hour
  await user.save();

  const resetURL = `http://localhost:${process.env.PORT}/reset-password/${user.resetToken}`;
  await transporter.sendMail({
    to: user.email,
    from: process.env.EMAIL_USER,
    subject: 'Password Reset',
    html: `<p>You requested a password reset</p>
           <p>Click this <a href="${resetURL}">link</a> to set a new password.</p>`,
  });

  res.send('Password reset link has been sent to your email.');
});

// Render reset password form
router.get('/reset-password/:token', async (req, res) => {
  const token = req.params.token;
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  });

  if (!user) return res.status(400).send('Invalid or expired token.');
  res.render('reset-password', { token });
});

// Handle new password submission
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  });

  if (!user) return res.status(400).send('Invalid or expired token.');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetToken = undefined;
  user.resetTokenExpiration = undefined;
  await user.save();

  res.send('Password has been updated successfully.');
});

module.exports = router;
