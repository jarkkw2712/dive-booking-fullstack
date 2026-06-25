import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import masterRoutes from "./routes/masterData.js";
import reportRoutes from "./routes/reports.js";
import lineRoutes from "./routes/line.js";

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req,res)=>res.json({ok:true, service:"dive-booking-api", time:new Date().toISOString()}));
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/master-data", masterRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/line", lineRoutes);

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`Dive Booking API running on http://localhost:${port}`));
