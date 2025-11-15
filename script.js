// script.js
import { supabase } from "./supabase.js";

/* --------------------------
   1. AUTHENTICATION
--------------------------- */

// LOGIN
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;

    // update last_login
    await supabase
        .from("mpdsr_users")
        .update({ last_login: new Date().toISOString() })
        .eq("user_id", data.user.id);

    return data;
}

// LOGOUT
export async function logout() {
    await supabase.auth.signOut();
}

// CURRENT USER SESSION
export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}

/* --------------------------
   2. FACILITIES
--------------------------- */

// GET ALL FACILITIES
export async function getFacilities() {
    const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .eq("is_active", true)
        .order("facility_name", { ascending: true });

    if (error) throw error;
    return data;
}

/* --------------------------
   3. MPDSR USERS
--------------------------- */

// GET USER PROFILE + ROLE
export async function getMPDSRUser(user_id) {
    const { data, error } = await supabase
        .from("mpdsr_users")
        .select("*, facilities(facility_name)")
        .eq("user_id", user_id)
        .single();

    if (error) throw error;
    return data;
}

// GET ALL USERS (admin-only)
export async function getAllUsers() {
    const { data, error } = await supabase
        .from("mpdsr_users")
        .select("*, facilities(facility_name)")
        .order("full_name");

    if (error) throw error;
    return data;
}

/* --------------------------
   4. MPDSR CASES
--------------------------- */

// CREATE NEW CASE
export async function createCase(payload) {
    const { data, error } = await supabase
        .from("mpdsr_cases")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data;
}

// FETCH CASES FOR FACILITY
export async function getCases(facility_id) {
    const { data, error } = await supabase
        .from("mpdsr_cases")
        .select("*, facilities(facility_name)")
        .eq("reporting_facility_id", facility_id)
        .order("death_date", { ascending: false });

    if (error) throw error;
    return data;
}

/* --------------------------
   5. MPDSR REVIEWS
--------------------------- */

// ADD CASE REVIEW
export async function addReview(payload) {
    const { data, error } = await supabase
        .from("mpdsr_reviews")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data;
}

// GET REVIEWS FOR CASE
export async function getReviews(case_id) {
    const { data, error } = await supabase
        .from("mpdsr_reviews")
        .select("*, mpdsr_users(full_name)")
        .eq("case_id", case_id)
        .order("review_date", { ascending: false });

    if (error) throw error;
    return data;
}

/* --------------------------
   6. MPDSR RECOMMENDATIONS
--------------------------- */

export async function addRecommendation(payload) {
    const { data, error } = await supabase
        .from("mpdsr_recommendations")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getRecommendations(review_id) {
    const { data, error } = await supabase
        .from("mpdsr_recommendations")
        .select("*")
        .eq("review_id", review_id)
        .order("created_at");

    if (error) throw error;
    return data;
}
