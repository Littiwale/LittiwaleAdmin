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

app.use(express.static(path.join(__dirname, "public")));

const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Littiwale Pure Supabase API is running", timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log("⚡ [LITTIWALE] Pure Supabase Server running on http://localhost:" + PORT);
    });
}

module.exports = app;
