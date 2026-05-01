const nodemailer = require("nodemailer");

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = 465;
const SMTP_SECURE = true;
const SMTP_USER = "hi@mailaverse.io";
const SMTP_PASSWORD = process.env.MAILAVERSE_SMTP_PASSWORD;
const DEFAULT_FROM = "hi@mailaverse.io";

function createMailTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

function htmlToText(html = "") {
  return `${html}`
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendHtmlEmail({ to, subject, html, from = DEFAULT_FROM }) {
  const transporter = createMailTransport();

  await transporter.sendMail({
    from,
    to,
    subject,
    text: htmlToText(html),
    html,
  });
}

module.exports = {
  DEFAULT_FROM,
  createMailTransport,
  htmlToText,
  sendHtmlEmail,
};