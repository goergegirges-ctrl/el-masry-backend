import { supabase } from "../config/supabaseClient.js";
import crypto from "crypto";

// @desc    Add a review
// @route   POST /api/reviews/add
const addReview = async (req, res) => {
    try {
        const { productId, rating, comment, userId } = req.body;
        const user = req.user; // From authMiddleware

        // Construct new review
        const newReview = {
            id: crypto.randomUUID(),
            productId,
            userId,
            rating: Number(rating),
            comment,
            username: user ? `${user.firstName} ${user.lastName}` : "Anonymous"
        };

        const { error } = await supabase.from('reviews').insert([newReview]);

        if (error) throw error;

        // Note: Legacy code updated a dynamic 'ratings.average' field in MongoDB's product collection.
        // Since Supabase Postgres strictly enforces the defined schema (which doesn't include 'ratings' cache),
        // average rating should be calculated natively by the client, or via a Postgres View/RPC if needed.
        // For zero-front-end changes, if the frontend strictly looks for product.ratings.average, 
        // we might have needed a JSONB cache in products. For now, we skip the product table update.

        res.json({ success: true, message: "Review added successfully" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error adding review" });
    }
}

// @desc    Get reviews for a product
// @route   GET /api/reviews/:productId
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('productId', productId)
            .order('createdAt', { ascending: false });
            
        if (error) throw error;
        
        res.json({ success: true, data: reviews || [] });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching reviews" });
    }
}

export { addReview, getProductReviews };
