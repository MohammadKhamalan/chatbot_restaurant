import app from "./server.js";

const PORT = 4242;

app.listen(PORT, () => {
  console.log(`🚀 Local backend running at http://localhost:${PORT}`);
});
