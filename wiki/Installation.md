# Installation & Setup

This page contains the complete step by step guide to set up the Textile Quotation System on your local machine.

---

## Prerequisites

Before starting make sure you have the following installed:

| Tool | Purpose | Download |
|---|---|---|
| Node.js v18+ | Runs the backend server | https://nodejs.org |
| MariaDB | Database server | https://mariadb.org |
| Git | Version control | https://git-scm.com |
| WSL (Linux) | Linux environment on Windows | Windows Store |
| IntelliJ IDEA | Development environment | https://www.jetbrains.com/idea/ |

### IntelliJ IDEA
Download **IntelliJ IDEA Ultimate (Version 2025.2.6)**.
Use your **university email ID** to get a free JetBrains student licence for IDEA Ultimate at https://www.jetbrains.com/student/

### WSL (Windows Subsystem for Linux)
Open PowerShell as Administrator and run:
```bash
wsl --install
```
Restart your computer after installation. This gives you a Linux terminal on Windows.

### GitHub Repository
The project is hosted at:
https://github.com/Rewant1908/CSE250-TextileQuotation

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Rewant1908/CSE250-TextileQuotation.git
cd CSE250-TextileQuotation
```

This downloads the project to your local machine and moves into the project folder.

---

## Step 2 — Understanding Package Setup

When Node.js was first initialized for this project, the following command was run:

```bash
npm init -y
```

| Part | Meaning |
|---|---|
| `npm` | Node Package Manager — manages all project dependencies |
| `init` | Initializes a new Node.js project |
| `-y` | Short for `--yes` — automatically accepts all default settings and creates `package.json` |

### Dependencies Installed

```bash
npm install express mariadb cors dotenv
```

| Package | Purpose |
|---|---|
| `express` | Web framework for handling routes and HTTP requests |
| `mariadb` | Database driver to connect and run SQL queries on MariaDB |
| `cors` | Allows the frontend to communicate with the backend across different ports |
| `dotenv` | Loads environment variables from `.env` file to keep passwords secure |

### Files Generated After Install

| File / Folder | Purpose |
|---|---|
| `node_modules/` | Contains all downloaded library files — never committed to GitHub |
| `package.json` | Lists all dependencies and project metadata |
| `package-lock.json` | Locks exact versions for consistent environments across machines |

---

## Step 3 — Install Dependencies

```bash
npm install
```

This reads `package.json` and installs all required packages into the `node_modules` folder.

---

## Step 4 — Set Up the Database

Start your MariaDB server and run:

```bash
mariadb -u root -p -e "CREATE DATABASE kt_impex;"
mariadb -u root -p kt_impex < database/schema.sql
```

The first command creates the database. The second runs the schema file which creates all 4 tables — `customers`, `products`, `quotations`, `quotation_items`.

---

## Step 5 — Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your actual credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mariadb_password
DB_NAME=kt_impex
PORT=5000
```

> Never commit your real `.env` file to GitHub. It is listed in `.gitignore` for this reason.

---

## Step 6 — Start the Server

```bash
npm start
```

You should see:

```
🚀 Dealer Server running on port 5000
✅ MariaDB Connected to KT Impex Engine
```

If you see these two lines the backend is fully running.

---

## Step 7 — Open the Frontend

Open `frontend/index.html` directly in your browser. The frontend connects to the backend at `http://localhost:5000`.

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `DB Connection Error` | Wrong password in `.env` | Check `DB_PASS` in `.env` |
| `Unknown database kt_impex` | Database not created | Run Step 4 again |
| `Cannot find module` | Dependencies not installed | Run `npm install` in backend folder |
| `Port 5000 already in use` | Another process using port 5000 | Change `PORT` in `.env` to `5001` |
| `permission denied` | WSL file permission issue | Run `chmod +x` on the file |
