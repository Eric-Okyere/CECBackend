import nodemailer from "nodemailer";

let transporter;
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER / EMAIL_PASS are not configured.");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password, not the real password
      },
    });
  }
  return transporter;
};

export const sendVerificationEmail = async (email, code) => {
  const safeCode = String(code).replace(/\D/g, "");
  return getTransporter().sendMail({
    from: `"CEC Extra Classes" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your CEC Extra Classes verification code",
    text: `Your verification code is ${safeCode}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; text-align: center;">
        <h2>Welcome to CEC Extra Classes!</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${safeCode}</h1>
        <p>This code expires in 10 minutes. If you did not sign up, you can ignore this email.</p>
      </div>
    `,
  });
};
