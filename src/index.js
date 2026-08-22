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

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`KKSDENTAL Lab API running on port ${PORT}`));

// Safety net: an unguarded async route error (like the one that caused the
// Aug 14 crash loop) throws an unhandled rejection at the process level in
// Express 4. Without this, that takes the entire server down and Render
// restarts it repeatedly - every user gets randomly logged out or blocked
// mid-action until the fix ships. Logging instead of crashing keeps one bad
// request from affecting everyone else; the route itself still returns
// whatever error it hit to the person who triggered it.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (server stayed up):", err);
});