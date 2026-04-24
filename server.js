import dotenv from "dotenv"
dotenv.config({ override: true })
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
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
app.use(cookieParser())

// CORS configuration - Allow multiple origins including local dev
const allowedOrigins = [
  'http://localhost:5173', // Frontend
  'http://localhost:5174', // Admin
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}))

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
