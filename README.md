# UniManager

A university course management application with Firebase sync capabilities.

## Versions

This repository contains two versions of the application:

### V2 (TypeScript) - Recommended
- **Location:** Root directory (`src/`, `index.html`)
- **Technology:** TypeScript, Vite, ES Modules, npm-based Firebase SDK
- **Build:** Requires `npm run build` to generate production assets
- **Features:** Type safety, modern tooling, better code organization

### V1 (Legacy JavaScript)
- **Location:** `v1/` directory
- **Technology:** Plain JavaScript, CDN-based Firebase SDK
- **Build:** No build step required (static files)
- **Note:** Maintained for backward compatibility

## Development

### V2 Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### V1 Development
Simply serve the `v1/` directory with any static file server:
```bash
# Using npx
npx serve v1

# Or any other static server
```

## Deployment

Deployment is handled via GitHub Actions. You can choose which version to deploy:

### Automatic Deployment (V2)
- Push to `main` branch automatically deploys **V2** to GitHub Pages

### Manual Deployment (Choose Version)
1. Go to **Actions** tab in GitHub
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select version (`v1` or `v2`) from the dropdown
5. Click **Run workflow**

## Firebase Configuration

Firebase configuration is managed via GitHub Secrets (never committed to the repo).

### Required Secrets
Add these secrets in **Settings → Secrets and variables → Actions**:

| Secret Name | Description |
|-------------|-------------|
| `FIREBASE_API_KEY` | Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | Auth domain (e.g., `project.firebaseapp.com`) |
| `FIREBASE_DATABASE_URL` | Realtime Database URL |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_MEASUREMENT_ID` | Analytics measurement ID (optional) |

### Local Development
1. Copy `src/services/firebase-config.example.ts` to `src/services/firebase-config.ts` (for V2)
2. Or copy `v1/js/firebase-config.example.js` to `v1/js/firebase-config.js` (for V1)
3. Fill in your Firebase project credentials

⚠️ **Never commit actual Firebase config files to version control!**

## Project Structure

```
UniManager/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions deployment
├── src/                     # V2 TypeScript source
│   ├── main.ts              # Entry point
│   ├── constants/           # Application constants
│   ├── render/              # UI rendering logic
│   ├── services/            # Business logic & Firebase
│   ├── state/               # State management
│   ├── styles/              # CSS styles
│   ├── types/               # TypeScript types
│   └── utils/               # Utility functions
├── v1/                      # V1 Legacy JavaScript
│   ├── index.html           # Entry point
│   ├── css/                 # Stylesheets
│   └── js/                  # JavaScript modules
├── index.html               # V2 entry point
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite build config
└── README.md                # This file
```

## License

Private project.
