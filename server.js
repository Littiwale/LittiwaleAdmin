require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/littiwale-admin";

const connectDB = async (req, res, next) => {
    if (mongoose.connection.readyState >= 1) {
        return next();
    }
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        next();
    } catch (err) {
        console.error("MongoDB Connection Error:", err);
        return res.status(500).json({ error: "Database connection failed: " + err.message });
    }
};

app.use(express.static(path.join(__dirname, "public")));

const apiRoutes = require("./routes/api");
app.use("/api", connectDB, apiRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Littiwale Admin API is running" });
});

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log("Server running on http://localhost:" + PORT);
    });
}

module.exports = app;
