require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const patientsRoutes = require("./routes/patients.routes");
const casesRoutes = require("./routes/cases.routes");
const clinicsRoutes = require("./routes/clinics.routes");
const pricingRoutes = require("./routes/pricing.routes");
const reportsRoutes = require("./routes/reports.routes");
const galleryRoutes = require("./routes/gallery.routes");
const blogRoutes = require("./routes/blog.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const staffRoutes = require("./routes/staff.routes");
const adsRoutes = require("./routes/ads.routes");
const eventsRoutes = require("./routes/events.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Public privacy policy page - required by Google Play for the store
// listing. Plain server-rendered HTML, no auth, no build step needed.
app.get("/privacy-policy", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy - KKSDENTAL Lab</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 26px; margin-bottom: 4px; }
    .updated { color: #6b6b6b; font-size: 14px; margin-bottom: 32px; }
    h2 { font-size: 18px; margin-top: 32px; }
    p, li { font-size: 15px; color: #2a2a2a; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: [DATE]</p>

  <p>
    KKSDENTAL Lab ("we", "us", "the app") provides a dental lab management platform used by
    KKSDENTAL Lab and the dental clinics that work with it. This policy explains what
    information the app collects, how it is used, and who can access it.
  </p>

  <h2>Who this app is for</h2>
  <p>
    This app is a business tool. Every account (lab admin, lab staff, and dentist/clinic
    accounts) is created directly by KKSDENTAL Lab - there is no public self-registration.
  </p>

  <h2>Information we collect</h2>
  <ul>
    <li><strong>Account information:</strong> name, email address, and login username for each
      user we create (lab staff and clinic accounts).</li>
    <li><strong>Clinic business details:</strong> clinic name, contact person, phone number, and
      address, provided when a clinic account is set up.</li>
    <li><strong>Patient records:</strong> name, age, and gender, entered by a clinic when
      registering a patient for lab work. This information is entered by the clinic, not
      collected directly from patients by the app.</li>
    <li><strong>Case/order details:</strong> the dental service requested, tooth information,
      pricing, and order status.</li>
    <li><strong>Patient photos:</strong> optionally uploaded by a clinic as reference material for
      a specific lab order.</li>
    <li><strong>Payment records:</strong> the amount and method (cash or UPI) of payments recorded
      against a clinic's account. We do not collect or store card numbers or bank account
      details anywhere in the app.</li>
    <li><strong>Device/login information:</strong> basic device type and IP address logged at
      sign-in, for account security purposes, plus a push notification token if notifications
      are enabled.</li>
  </ul>

  <h2>How this information is used</h2>
  <p>
    All of the above is used solely to operate the dental lab management service: creating and
    tracking orders, managing each clinic's invoice/payment history, and coordinating work
    between clinics and the lab. We do not sell any information, and we do not use it for
    advertising.
  </p>

  <h2>Who can see this information</h2>
  <p>
    A clinic can only see its own patients, orders, and account history - never another
    clinic's data. KKSDENTAL Lab's admin and lab staff can see order and patient information
    needed to fulfill lab work; lab staff accounts specifically do not have access to billing
    or payment information.
  </p>

  <h2>Where information is stored</h2>
  <p>
    Data is stored in a managed PostgreSQL database (via Supabase) and the application server
    runs on Render. Both are standard cloud infrastructure providers; we do not operate our own
    physical servers.
  </p>

  <h2>Data retention</h2>
  <p>
    Information is retained for as long as the associated account is active, so clinics retain
    access to their own order history and invoices. A clinic or staff account can be deactivated
    or removed by the lab admin at any time.
  </p>

  <h2>Children</h2>
  <p>
    This app is not directed at children and is not used by children directly - it is a
    business tool used by dental clinic staff. Patient records may include a minor's basic
    information (such as name and age) where a clinic is submitting lab work on behalf of a
    minor patient, entered by clinic staff rather than collected from the child.
  </p>

  <h2>Your choices</h2>
  <p>
    If you are a clinic or staff member with an account and want a copy of your data, or want
    it corrected or deleted, contact us using the details below.
  </p>

  <h2>Changes to this policy</h2>
  <p>
    If this policy changes, the updated version will be posted at this same page with a revised
    "Last updated" date.
  </p>

  <h2>Contact us</h2>
  <p>
    Questions about this policy or your data can be sent to: <strong>[SUPPORT EMAIL]</strong>
  </p>
</body>
</html>`);
});

// Public account deletion instructions - required by Google Play whenever
// an app has user accounts, even ones created by an admin rather than
// self-registered. Separate from the privacy policy page since Google
// specifically wants deletion steps to be prominent on their own.
app.get("/delete-account", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delete Your Account - KKSDENTAL Lab</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 26px; margin-bottom: 24px; }
    h2 { font-size: 18px; margin-top: 32px; }
    p, li { font-size: 15px; color: #2a2a2a; }
    ol, ul { padding-left: 22px; }
    .step { background: #f7f7f7; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Delete Your KKSDENTAL Lab Account</h1>

  <p>
    KKSDENTAL Lab accounts (admin, lab staff, and clinic/dentist accounts) are created directly
    by KKSDENTAL Lab rather than through self-registration in the app. To keep account deletion
    simple and secure, requests are handled directly by our team rather than as an automated
    in-app action.
  </p>

  <h2>How to request deletion</h2>
  <div class="step">
    <ol>
      <li>Email <strong>[SUPPORT EMAIL]</strong> from the email address associated with your account, or
        include your username and clinic name in the message.</li>
      <li>State that you want your account and associated data deleted.</li>
      <li>We will confirm your identity and process the request within a reasonable time, and
        will follow up once it's complete.</li>
    </ol>
  </div>

  <h2>What gets deleted</h2>
  <ul>
    <li>Your login credentials (username, password, email) are permanently deleted.</li>
    <li>Your access to the app is immediately revoked.</li>
  </ul>

  <h2>What may be retained, and why</h2>
  <ul>
    <li>Patient records and order history tied to a clinic account may be retained for standard
      business record-keeping (such as invoicing history and warranty tracking on completed lab
      work), even after the associated login is deleted.</li>
    <li>If you would like these records fully erased as well rather than retained, state this
      explicitly in your deletion request, and we will accommodate it unless we're required to
      keep certain records for legal or accounting purposes.</li>
  </ul>

  <p>
    Questions about this process can be sent to <strong>[SUPPORT EMAIL]</strong>.
  </p>
</body>
</html>`);
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/clinics", clinicsRoutes);
app.use("/api/catalog", pricingRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/events", eventsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`KKSDENTAL Lab API running on port ${PORT}`));

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (server stayed up):", err);
});