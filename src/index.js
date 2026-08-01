require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const patientsRoutes = require("./routes/patients.routes");
const casesRoutes = require("./routes/cases.routes");
const clinicsRoutes = require("./routes/clinics.routes");
const pricingRoutes = require("./routes/pricing.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/cases", casesRoutes);
app.use("/api/clinics", clinicsRoutes);
app.use("/api/catalog", pricingRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`KKSDENTAL Lab API running on port ${PORT}`));
