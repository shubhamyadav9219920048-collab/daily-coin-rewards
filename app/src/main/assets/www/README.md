# Daily Rewards - Web Ledger (AdSense Ready)

This is the complete, self-contained, fully AdSense-ready web version of your Daily Rewards & Web Ledger app. It includes all the visual styles, responsive layouts, interactive coin features, Firebase backend integration, and a dedicated compliance Information Hub.

## Files Included

- `index.html`: The main web application HTML structure containing layout nodes, dynamic Tailwind definitions, script linkages, and compliance info pages.
- `style.css`: Custom CSS styling for the smooth gold ambient glows, float animations, custom scrollbars, and aesthetic layout details.
- `script.js`: All interactive client-side logic including Sandbox mode simulation, cookie consent, contact support ticketing, and modular Cloud Firestore/Auth synchronization.

## Features Highlights & AdSense Compliance

1. **Information Hub Pages**: Built-in dedicated sections for **About Us**, **Privacy Policy**, **Terms & Conditions**, **Contact Us** (with interactive support form), and **FAQ** (with smooth accordion transitions) accessible from a global footer.
2. **Cookie Consent Banner**: Sleek, eye-safe, and responsive cookie banner that respects user preferences on landing.
3. **Rewards Disclaimer**: Clear labels indicating rewards are promotional points and subject to administrative ledger verification.
4. **AdSense Ads Placeholders**: Strategic non-intrusive AdSense ad slots pre-configured with compliant, responsive layout markers.
5. **No Deceptive Behavior**: All mock ad playing mechanisms removed, with locked ad modules clearly labeled as "Coming Soon" to pass publisher review perfectly.

## How to Run Locally

1. **Open index.html**: You can double-click `index.html` to open it in any modern web browser.
2. **Local Server (Optional but Recommended)**: To test all features perfectly, run a local web server:
   - If you have Python installed:
     ```bash
     python3 -m http.server 8000
     ```
     Then open `http://localhost:8000` in your browser.
   - Or use the VS Code "Live Server" extension if you are using VS Code.

## How to Configure Your Firebase

Inside `script.js`, there is a Firebase configuration section. If you want to use your own Firebase project:
1. Go to your [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (or use an existing one).
3. Add a Web App to your Firebase project.
4. Copy the `firebaseConfig` object provided by Firebase.
5. In `script.js` (near the top), find the script block with `firebaseConfig` and replace it with your own credentials:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```
6. Ensure **Email/Password** authentication and **Firestore Database** are enabled in your Firebase Console.

## Deploying to Netlify / Vercel / GitHub Pages

This app is production-ready! Since it is a single-file static web application:
- **Netlify**: Simply drag and drop the folder containing `index.html` into the Netlify Drop dashboard, or connect your GitHub repository.
- **GitHub Pages**: Push this code to a GitHub repository, go to Settings -> Pages, and enable it on the `main`/`master` branch.
