import "dotenv/config"
import express from "express"
import cors from "cors"
import { supabase } from "./config/supabaseClient.js"
import productRouter from "./routs/productRoute.js"
import orderRouter from "./routs/orderRoute.js"
import adminRouter from "./routs/adminRoute.js"
import userRouter from "./routs/userRoute.js"
import reviewRouter from "./routs/reviewRoute.js"

const app = express()
const port = process.env.PORT || 4000

// middleware
app.use(express.json())
app.use(cors())
app.use("/images", express.static('uploads'))

// api endpoints
app.use("/api/product", productRouter)
app.use("/api/order", orderRouter)
app.use("/api/admin", adminRouter)
app.use("/api/users", userRouter)
app.use("/api/reviews", reviewRouter)

app.get("/", (req, res) => {
  res.send("API Working ✅")
})

// Connect to Database/Services first, then start the server
const startServer = async () => {
  // Verify Supabase is initialized
  if (supabase) {
    console.log("🔗 Supabase Client initialized and verified");
  } else {
    console.warn("⚠️ Supabase Client failing to initialize");
  }

  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`)
  })
}

startServer();
