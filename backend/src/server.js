import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import roleRoutes from "./routes/roles.js";
import bookingRoutes from "./routes/bookings.js";
import masterRoutes from "./routes/masterData.js";
import masterDataProRoutes from "./routes/masterDataPro.js";
import reportRoutes from "./routes/reports.js";
import lineRoutes from "./routes/line.js";
import companyProfileRoutes from "./routes/companyProfile.js";
import permissionRoutes from "./routes/permissions.js";
import auditRoutes from "./routes/auditLogs.js";

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req,res)=>res.json({ok:true, service:"dive-booking-api", time:new Date().toISOString()}));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/master-data", masterRoutes);
app.use("/api/master-data-pro", masterDataProRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/line", lineRoutes);
app.use("/api/company-profile", companyProfileRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/audit-logs", auditRoutes);

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`Dive Booking API running on http://localhost:${port}`));
