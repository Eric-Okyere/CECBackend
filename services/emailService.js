import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use an App Password, not your real password
  },
});

export const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: '"JHS HUB" <your-email@gmail.com>',
    to: email,
    subject: "Verify your JHS HUB Account",
    html: `
      <div style="font-family: sans-serif; text-align: center;">
        <h2>Welcome to CEC Extra Classes!</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${code}</h1>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};