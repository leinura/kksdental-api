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