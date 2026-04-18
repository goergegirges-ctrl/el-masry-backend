import express from "express";
import { getProductById, addProduct, listProducts, listActiveProducts, listFeaturedProducts, removeProduct, updateProduct, listCategories, getCategoryList, getLowStock, searchProducts } from "../controllers/productController.js"
import authAdmin from "../middlewar/authAdmin.js";

const productRouter = express.Router();

// Logic for local storage removed as we migrated to hosted URLs
// Currently we receive URLs directly in the request body.

productRouter.post("/add", authAdmin, addProduct)
productRouter.put("/update", authAdmin, updateProduct)
productRouter.get("/list", listProducts)
productRouter.get("/active", listActiveProducts)
productRouter.get("/featured", listFeaturedProducts)
productRouter.get("/search", searchProducts)
productRouter.get("/categories", listCategories)
productRouter.get("/category/list", getCategoryList)
productRouter.get("/low-stock", authAdmin, getLowStock)
productRouter.get("/:id", getProductById)
productRouter.post("/remove", authAdmin, removeProduct);

export default productRouter;