require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(compression());
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "x-admin-pin"]
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-pin");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.static(path.join(__dirname, "public")));

const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

let supabaseDb = null;
try {
    supabaseDb = require("./utils/supabaseDb");
} catch(e) {
    console.error("Could not load supabaseDb for health check:", e.message);
}

const handleHealthCheck = async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    let dbStatus = "skipped";
    if (supabaseDb && typeof supabaseDb.query === "function") {
        try {
            await supabaseDb.query("SELECT 1");
            dbStatus = "connected";
        } catch (dbErr) {
            dbStatus = "error: " + dbErr.message;
        }
    }
    res.json({
        status: "ok",
        db: dbStatus,
        message: "Littiwale Pure Supabase API is warm & running",
        timestamp: new Date().toISOString()
    });
};

app.get("/api/health", handleHealthCheck);
app.get("/health", handleHealthCheck);

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log("⚡ [LITTIWALE] Pure Supabase Server running on http://localhost:" + PORT);
    });
}

module.exports = app;
