const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/upload", (req, res) => {
  console.log("Received file:", req.body);
  res.status(200).json({ success: true, received: req.body });
});

app.get("/", (req, res) => {
  res.status(200).send("Receipt app is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
