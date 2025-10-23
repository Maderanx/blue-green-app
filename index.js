const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const COLOR = process.env.COLOR || "blue"; // default if env not set

app.get("/", (req, res) => {
  res.send(`<h1 style="text-align:center;">Hello from ${COLOR} version!</h1>`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - ${COLOR}`);
});
