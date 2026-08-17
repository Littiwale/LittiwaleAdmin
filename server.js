require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
