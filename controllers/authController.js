const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { frontendUrl, inviteSecret, jwtSecret } = require('../config/env');

const createToken = (id) => jwt.sign({ _id: id.toString() }, jwtSecret, { expiresIn: '30d' });
const createInviteToken = ({ inviterId, inviterName, email }) =>
  jwt.sign({ inviterId, inviterName, email }, inviteSecret, { expiresIn: '7d' });

const decodeInviteToken = (inviteToken) => jwt.verify(inviteToken, inviteSecret);

const createInviteTransport = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === 'true';

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error('Invite email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  // Lazy load so the server can still boot even before dependencies are installed.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const nodemailer = require('nodemailer');

  // return nodemailer.createTransport({
  //   host: smtpHost,
  //   port: Number(smtpPort),
  //   secure: Number(smtpPort) === 465,
  //   auth: {
  //     user: smtpUser,
  //     pass: smtpPass
  //   },
  //   tls: allowSelfSigned
  //     ? {
  //         rejectUnauthorized: false
  //       }
  //     : undefined
  // });
return nodemailer.createTransport({
  host: smtpHost,
  port: Number(smtpPort),
  secure: false,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  tls: {
    rejectUnauthorized: false
  }
});
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, inviteToken } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    let invitePayload = null;
    if (inviteToken) {
      invitePayload = decodeInviteToken(inviteToken);
      if (invitePayload.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ error: 'Invite email does not match registration email' });
      }
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const user = new User({ username, email, password });
    const token = createToken(user._id);
    user.tokens = [{ token }];
    await user.save();

    if (invitePayload?.inviterId) {
      const inviter = await User.findById(invitePayload.inviterId);
      if (inviter && inviter._id.toString() !== user._id.toString()) {
        if (!inviter.connections.some((entry) => entry.toString() === user._id.toString())) {
          inviter.connections.push(user._id);
        }
        if (!user.connections.some((entry) => entry.toString() === inviter._id.toString())) {
          user.connections.push(inviter._id);
        }
        inviter.connectionRequestsSent = inviter.connectionRequestsSent.filter((entry) => entry.toString() !== user._id.toString());
        inviter.connectionRequestsReceived = inviter.connectionRequestsReceived.filter((entry) => entry.toString() !== user._id.toString());
        user.connectionRequestsSent = user.connectionRequestsSent.filter((entry) => entry.toString() !== inviter._id.toString());
        user.connectionRequestsReceived = user.connectionRequestsReceived.filter((entry) => entry.toString() !== inviter._id.toString());
        await Promise.all([inviter.save(), user.save()]);
      }
    }

    const userData = user.toObject();
    delete userData.password;
    delete userData.tokens;

    res.status(201).json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = createToken(user._id);
    user.tokens.push({ token });
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    delete userData.tokens;

    res.json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((entry) => entry.token !== req.token);
    await req.user.save();
    res.json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMe = async (req, res) => {
  const userData = req.user.toObject();
  delete userData.password;
  delete userData.tokens;
  res.json(userData);
};

exports.sendInvite = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'That email is already registered' });
    }

    const inviteToken = createInviteToken({
      inviterId: req.user._id.toString(),
      inviterName: req.user.username,
      email: normalizedEmail
    });
    const inviteLink = `${frontendUrl}/register?invite=${encodeURIComponent(inviteToken)}`;
    const transport = createInviteTransport();

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalizedEmail,
      subject: `${req.user.username} invited you to join Strangers Play`,
      text: `${req.user.username} invited you to join Strangers Play. Register here: ${inviteLink}`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#14213d">
          <h2 style="margin-bottom:12px;">You are invited to Strangers Play</h2>
          <p><strong>${req.user.username}</strong> invited you to join and connect.</p>
          <p>
            <a href="${inviteLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2a9d8f;color:#ffffff;text-decoration:none;">
              Register Now
            </a>
          </p>
          <p>If the button does not work, use this link:</p>
          <p><a href="${inviteLink}">${inviteLink}</a></p>
        </div>
      `
    });

    res.json({ message: 'Invite sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to send invite' });
  }
};

exports.validateInvite = async (req, res) => {
  try {
    const invite = decodeInviteToken(req.params.inviteToken);
    res.json({
      email: invite.email,
      inviterName: invite.inviterName,
      inviterId: invite.inviterId
    });
  } catch (error) {
    res.status(400).json({ error: 'Invite link is invalid or expired' });
  }
};
