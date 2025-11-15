// signup.js

// Import necessary utilities and state from the main script.
// Note: Paths must match your deployment structure.
import { renderMain, navigate, state, escapeHtml, $, fetchFacilities, renderLogin } from "/nakurucountympdsrdashboard/script.js";

// Define the supabase client by accessing the global window object.
const supabase = window.supabase; 

// 1. Supabase API Wrapper
export async function signUpNewUser(email, password) {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const resp = await supabase.auth.signUp({ email, password });
    if (resp.error) throw resp.error;
    return resp.data;
}

// 2. Render Function (exported for script.js to use)
export const renderSignUp = (errorMessage = '') => {
    renderMain(`
      <div class="h-full flex items-center justify-center bg-gray-100">
        <div class="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
          <h1 class="text-2xl font-bold text-center mb-4">Create MPDSR Account</h1>

          <input id="email" type="email" placeholder="Email"
            class="w-full p-3 mb-3 border rounded" />
            
          <input id="password" type="password" placeholder="Password (min 6 characters)"
            class="w-full p-3 mb-4 border rounded" />
            
          <button id="signUpBtn"
            class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">Sign Up</button>

          <p id="error" class="text-red-500 text-center mt-3">${escapeHtml(errorMessage)}</p>
          
          <p class="text-center text-sm mt-4">
              Already have an account? 
              <button id="goToLogin" class="text-blue-600 hover:underline font-medium">Log In</button>
          </p>
        </div>
      </div>
    `);
    
    // Go to Login listener
    $('#goToLogin').onclick = () => {
        navigate('login');
    };

    // Sign Up logic
    $('#signUpBtn').onclick = async () => {
        const email = $('#email').value.trim();
        const password = $('#password').value.trim();
        
        if (password.length < 6) {
            renderSignUp('Password must be at least 6 characters long.');
            return;
        }

        try {
            await signUpNewUser(email, password);
            
            // Assuming email confirmation is required:
            navigate('login');
            renderLogin('Account created! Please check your email to confirm your account before logging in.');
            
        } catch (err) {
            renderSignUp(err.message || String(err));
        }
    };
};
