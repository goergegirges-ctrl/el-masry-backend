import { supabase } from "../config/supabaseClient.js";
import crypto from "crypto";

const isValidImageUrl = (url) => {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

// add product item
const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, condition, images, isActive, isFeatured } = req.body;

    // Validate images
    let imageArray = [];
    if (Array.isArray(images)) {
      imageArray = images;
    } else if (typeof images === 'string') {
      try {
        imageArray = JSON.parse(images);
      } catch (e) {
        imageArray = [images];
      }
    }

    if (imageArray.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image URL is required" });
    }

    const invalidUrls = imageArray.filter(url => !isValidImageUrl(url));
    if (invalidUrls.length > 0) {
      return res.status(400).json({ success: false, message: "Invalid image URL(s) detected. Must start with http:// or https://" });
    }

    const newProduct = {
      id: crypto.randomUUID(), // UUID as id
      name,
      description: description || "",
      price: Number(price),
      category,
      stock: Number(stock) || 0,
      condition: condition || "Original",
      images: imageArray,
      isActive: isActive === 'true' || isActive === true,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Auto-generate SKU if needed
    };

    const { error } = await supabase.from('products').insert([newProduct]);

    if (error) throw error;

    res.json({ success: true, message: "Product Added" })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: "Error adding product" })
  }
}

// all product list (for admin)
const listProducts = async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*').order('createdAt', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: products })
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" })
  }
}

// active product list (for frontend)
const listActiveProducts = async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*').eq('isActive', true).order('createdAt', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: products })
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" })
  }
}

// featured product list (for homepage)
const listFeaturedProducts = async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*').eq('isFeatured', true).order('createdAt', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: products })
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" })
  }
}

// update product item
const updateProduct = async (req, res) => {
  try {
    const { id, name, price, description, category, stock, isActive, isFeatured, condition, images } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    let updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = Number(price);
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (condition !== undefined) updateData.condition = condition;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured === 'true' || isFeatured === true;

    if (images) {
      let imageArray = [];
      if (Array.isArray(images)) {
        imageArray = images;
      } else if (typeof images === 'string') {
        try {
          imageArray = JSON.parse(images);
        } catch (e) {
          imageArray = [images];
        }
      }

      if (imageArray.length > 0) {
        const invalidUrls = imageArray.filter(url => !isValidImageUrl(url));
        if (invalidUrls.length > 0) {
          return res.status(400).json({ success: false, message: "Invalid image URL(s) detected. Must start with http:// or https://" });
        }
        updateData.images = imageArray;
      }
    }

    updateData.updatedAt = new Date().toISOString();

    const { error } = await supabase.from('products').update(updateData).eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: "Product Updated" });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ success: false, message: "Error updating product" });
  }
}

// remove product item
const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "Product ID is required" });

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: "Product Removed" })
  } catch (error) {
    console.error("Remove Product Error:", error);
    res.status(500).json({ success: false, message: "Error removing product" })
  }
}

// list unique categories for admin panel
const listCategories = async (req, res) => {
  try {
    // In Supabase, there isn't a direct distinct query without RPC.
    // Let's fetch all category names and first images from products to aggregate them dynamically.
    const { data: products, error } = await supabase.from('products').select('category, images');
    if (error) throw error;

    const categoryMap = {};
    for (const p of products) {
        if (!p.category) continue;
        if (!categoryMap[p.category]) {
            categoryMap[p.category] = { count: 0, image: p.images && p.images.length > 0 ? p.images[0] : null };
        }
        categoryMap[p.category].count += 1;
    }

    const categoryDetails = Object.keys(categoryMap).map(cat => ({
        name: cat,
        count: categoryMap[cat].count,
        image: categoryMap[cat].image
    }));

    res.json({ success: true, data: categoryDetails });
  } catch (error) {
    console.error("List Categories Error:", error);
    res.status(500).json({ success: false, message: "Error fetching categories" });
  }
}

// NEW: get full category details from categories table
const getCategoryList = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('nameEn', { ascending: true });
    
    if (error) throw error;
    res.json({ success: true, data: categories || [] });
  } catch (error) {
    console.error("Get Category List Error:", error);
    res.status(500).json({ success: false, message: "Error fetching category list" });
  }
}

// Get low stock products (stock < 5) for admin
const getLowStock = async (req, res) => {
  try {
    const { data: lowStockItems, error } = await supabase.from('products')
        .select('name, stock, images, category')
        .lt('stock', 5);
        
    if (error) throw error;
    
    res.json({ success: true, data: lowStockItems || [], count: lowStockItems ? lowStockItems.length : 0 });
  } catch (error) {
    console.error("Low Stock Error:", error);
    res.status(500).json({ success: false, message: "Error fetching low stock items" });
  }
}

// search products with filtering and sorting
const searchProducts = async (req, res) => {
  try {
    const { q, category, brand, minPrice, maxPrice, sort } = req.query;
    
    let query = supabase.from('products').select('*');

    // Text search using ilike on name, description, brand
    if (q) {
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,brand.ilike.%${q}%`);
    }

    // Faceted filters
    if (category) query = query.eq('category', category);
    if (brand) query = query.eq('brand', brand);
    
    if (minPrice) query = query.gte('price', Number(minPrice));
    if (maxPrice) query = query.lte('price', Number(maxPrice));

    // Determine sorting
    let sortColumn = 'createdAt';
    let sortAscending = false;

    if (sort === "price-low") {
        sortColumn = 'price';
        sortAscending = true;
    } else if (sort === "price-high") {
        sortColumn = 'price';
        sortAscending = false;
    } else if (sort === "newest") {
        sortColumn = 'createdAt';
        sortAscending = false;
    }

    query = query.order(sortColumn, { ascending: sortAscending });

    const { data: products, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: products || [] });
  } catch (error) {
    console.error("Search Products Error:", error);
    res.status(500).json({ success: false, message: "Error searching products" });
  }
}

// get single product details
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "ID is required" });

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Get Product By ID Error:", error);
    res.status(500).json({ success: false, message: "Error fetching product details" });
  }
}

export { getProductById, addProduct, listProducts, listActiveProducts, listFeaturedProducts, updateProduct, removeProduct, listCategories, getCategoryList, getLowStock, searchProducts }
