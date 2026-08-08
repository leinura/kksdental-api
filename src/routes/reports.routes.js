const express = require("express");
const PDFDocument = require("pdfkit");
const { PrismaClient } = require("@prisma/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth, requireRole("ADMIN", "LAB_STAFF"));

const COLUMNS = [
  { label: "Date", x: 40, width: 65 },
  { label: "Clinic", x: 110, width: 130 },
  { label: "Patient Code", x: 245, width: 90 },
  { label: "Amount (Rs)", x: 340, width: 90 },
];
const ROW_HEIGHT = 20;
const PAGE_BOTTOM = 760;

// GET /api/reports/export-pdf?clinicName=&from=&to=
router.get("/export-pdf", async (req, res) => {
  const { clinicName, from, to } = req.query;

  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (clinicName) {
    where.clinic = { name: { contains: clinicName, mode: "insensitive" } };
  }

  const cases = await prisma.case.findMany({
    where,
    include: { patient: true, clinic: true },
    orderBy: { createdAt: "desc" },
  });

  const totalAmount = cases.reduce((sum, c) => sum + Number(c.totalPrice), 0);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="kksdental-financial-report.pdf"');

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  // Note: using "Rs" instead of the Rupee symbol (Rs) since PDFKit's built-in
  // fonts don't include that glyph without embedding a custom font file.
  doc.fontSize(18).text("KKSDENTAL Lab", { align: "center" });
  doc.fontSize(12).fillColor("#666").text("Financial Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#888").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });

  const filterParts = [];
  if (clinicName) filterParts.push(`Clinic: ${clinicName}`);
  if (from) filterParts.push(`From: ${from}`);
  if (to) filterParts.push(`To: ${to}`);
  if (filterParts.length) {
    doc.text(filterParts.join(" · "), { align: "center" });
  }
  doc.moveDown(1.5);

  function drawTableHeader() {
    doc.fontSize(10).fillColor("#000").font("Helvetica-Bold");
    COLUMNS.forEach((col) => doc.text(col.label, col.x, doc.y, { width: col.width, continued: false }));
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(430, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica");
  }

  drawTableHeader();

  cases.forEach((c) => {
    if (doc.y > PAGE_BOTTOM) {
      doc.addPage();
      drawTableHeader();
    }
    const rowY = doc.y;
    doc.fontSize(9).fillColor("#222");
    doc.text(new Date(c.createdAt).toLocaleDateString(), COLUMNS[0].x, rowY, { width: COLUMNS[0].width });
    doc.text(c.clinic?.name || "", COLUMNS[1].x, rowY, { width: COLUMNS[1].width });
    doc.text(c.patient?.patientCode || "", COLUMNS[2].x, rowY, { width: COLUMNS[2].width });
    doc.text(Number(c.totalPrice).toFixed(2), COLUMNS[3].x, rowY, { width: COLUMNS[3].width });
    doc.y = rowY + ROW_HEIGHT;
  });

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(430, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica-Bold").text(`Total Orders: ${cases.length}`, 40, doc.y);
  doc.text(`Total Amount: Rs ${totalAmount.toFixed(2)}`, 40, doc.y + 16);

  doc.end();
});

module.exports = router;