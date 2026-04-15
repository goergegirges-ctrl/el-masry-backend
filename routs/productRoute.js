import express from "express";
import { getProductById, addProduct, listProducts, listActiveProducts, listFeaturedProducts, removeProduct, updateProduct, listCategories, getCategoryList, getLowStock, searchProducts } from "../controllers/productController.js"
import authMiddleware from "../middlewar/auth.js";

const productRouter = express.Router();

// Logic for local storage removed as we migrated to hosted URLs
// Currently we receive URLs directly in the request body.

productRouter.post("/add", authMiddleware, addProduct)
productRouter.put("/update", authMiddleware, updateProduct)
productRouter.get("/list", listProducts)
productRouter.get("/active", listActiveProducts)
productRouter.get("/featured", listFeaturedProducts)
productRouter.get("/search", searchProducts)
productRouter.get("/categories", listCategories)
productRouter.get("/category/list", getCategoryList)
productRouter.get("/low-stock", authMiddleware, getLowStock)
productRouter.get("/:id", getProductById)
productRouter.post("/remove", authMiddleware, removeProduct);

export default productRouter;