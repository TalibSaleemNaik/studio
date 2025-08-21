# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Deploying to Vercel

When you deploy this project to Vercel, you will need to configure your environment variables. Vercel does not have access to the `.env` file you use for local development.

1.  Go to your project's dashboard on Vercel.
2.  Navigate to the "Settings" tab.
3.  Click on "Environment Variables" in the sidebar.
4.  Add the following variables with the values from your Firebase project settings and Google AI Studio:

*   `NEXT_PUBLIC_FIREBASE_API_KEY`
*   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
*   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
*   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
*   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
*   `NEXT_PUBLIC_FIREBASE_APP_ID`
*   `GEMINI_API_KEY`

After adding these variables, redeploy your project on Vercel for the changes to take effect.
