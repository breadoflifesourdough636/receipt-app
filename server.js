const express = require("express");

const app = express();
app.use(express.json());

app.post("/upload", (req, res) => {
  console.log("Received file:", req.body);
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.send("Receipt app is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
