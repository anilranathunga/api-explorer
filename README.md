# API Explorer

A local React app that fetches OpenAPI/Swagger YAML files from GitHub and displays them in an interactive API documentation viewer. You can store multiple doc URLs and refresh to get the latest spec from GitHub.

## Prerequisites

- **Node.js** (v18 or later recommended)
- **npm** (comes with Node.js)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/anilranathunga/api-explorer.git
   cd api-explorer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Optional: GitHub token for private repos or higher rate limits**

   - For **public** repos you can run without a token (subject to GitHub’s unauthenticated rate limit).
   - For **private** repos you must provide a [GitHub Personal Access Token](https://github.com/settings/tokens) with the **repo** scope (or fine-grained with **Contents: Read** and access to the repo).

   Either:

   - Copy `.env.example` to `.env` and add your token:
     ```bash
     cp .env.example .env
     ```
     Then edit `.env` and set:
     ```
     VITE_GITHUB_TOKEN=ghp_your_token_here
     ```
   - Or add the token later in the app under **Settings** in the sidebar (stored in your browser only).

## Running the app

**Development (with hot reload):**

```bash
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`) in your browser.

**Production build:**

```bash
npm run build
npm run preview
```

Use `preview` to serve the built app locally.

## How to use

1. **Add an API doc**
   - In the sidebar, enter a **GitHub URL** to an OpenAPI/Swagger YAML file.
   - Optionally enter a **name** for the doc (e.g. “Chameleon API”); if you leave it blank, the filename (e.g. `specs.yaml`) is used.
   - Click **Add**. The doc is saved and fetched; the viewer shows the spec on the right.

2. **Supported URL formats**
   - **Blob:** `https://github.com/OWNER/REPO/blob/BRANCH_OR_SHA/path/to/file.yaml`
   - **Raw:** `https://raw.githubusercontent.com/OWNER/REPO/BRANCH_OR_SHA/path/to/file.yaml`  
   Query strings and hashes (e.g. `?raw=true`, `#L10`) are stripped automatically. Commit SHA refs are supported (the app uses the Git Data API when the Contents API returns 404 for a SHA).

3. **View and refresh**
   - Click a doc in the list to view it.
   - Click **Refresh** on a doc to re-fetch the YAML from GitHub and update the viewer.

4. **Rename or remove**
   - **Rename** lets you change the display name of a doc.
   - **Remove** deletes the doc from the list (and from local storage).

5. **Settings (GitHub token)**
   - Open **Settings** in the sidebar to set or change your GitHub token.
   - Required for **private** repos; optional for public repos (for higher rate limits).
   - Token is stored in your browser only. You can also set `VITE_GITHUB_TOKEN` in `.env`; the app will use it and sync it into Settings on first load.

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| Build for production       |
| `npm run preview` | Serve production build |
| `npm run lint` | Run ESLint                 |

## Tech stack

- **React** + **Vite**
- **swagger-ui-react** for rendering the API docs
- **js-yaml** for parsing YAML
- Doc list and token stored in **localStorage**
