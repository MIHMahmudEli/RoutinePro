# 🗓️ RoutinePro: Next-Gen Course Architect

RoutinePro is a high-performance, aesthetically stunning web application designed to solve the complex puzzle of university course scheduling. Built with a focus on **Glassmorphism UI** and **Dynamic Logic**, it allows students to generate thousands of possible routine scenarios in seconds.

[**Live Demo →**](https://routine-pro-fawn.vercel.app/)

---

## ✨ Core Features

### 🚀 High-Performance Generation
*   **Instant Scenarios**: Scans thousands of course combinations to find valid, conflict-free routines using a optimized backtracking engine.
*   **Gap Optimization**: Automatically calculates and tracks total weekly waiting time between classes.
*   **Scenario Explorer**: Navigate through all possible valid permutations found for your selected courses.

### 🌓 Advanced Workflow Modes
*   **🧩 Compact Mode**: Instantly toggle between full course titles and smart abbreviations (e.g., "Computer Networks" → "CN").
*   **🎯 Focus Mode**: A minimalist layout that hides empty days and crops the time grid to show only your active class hours.
*   **🌙 Ramadan Mode**: Dynamic timing engine that shifts your entire routine to match regional Ramadan schedules (e.g., AIUB timings) without manual adjustment.
*   **🕒 24-Hour Tracking**: Supports late-night and early-morning schedules for flexible degree paths.

### 📊 Seamless Data Integration
*   **Dynamic XLSX/JSON Sync**: Directly upload your university's "Offered Course Report" to update the local database.
*   **🧠 Intelligent Detection**: Automatically identifies the semester (e.g., SPRING 2024-25) from file metadata and content.
*   **☁️ Global Cloud Sync**: Admin-authenticated portal allows for global updates to course data and Ramadan mappings via Vercel Blob storage.

### 📸 Premium Export
*   **High-Resolution Branding**: Export your routine as a crisp PNG.
*   **Metadata Overlays**: Automatically embeds Academic Session name, Weekly Gap stats, and branding for easy sharing.
*   **Themed Exports**: The exported image maintains your selected design aesthetics.

---

## 🎨 Design Philosophy: Prism UI
RoutinePro utilizes a custom design system called **Prism**, focused on:
-   **Glassmorphism**: Heavy use of `backdrop-filter`, 1px borders, and floating surfaces.
-   **Dynamic Theming**: Support for multiple theme sets (Emerald, Rose, Amber, Indigo, Spectrum) that change global CSS variables.
-   **Micro-animations**: Smooth transitions, scale effects on interaction, and pop-in entrance animations.

---

## 🛠️ Technical Architecture

### Model-View-Controller (MVC)
*   **Model (`js/Model.js`)**: Manages the course database, persistence via `localStorage`, and the core routine generation algorithm.
*   **View (`js/View.js`)**: Handles all DOM manipulations, rendering of the grid, sidebar, and feedback toasts.
*   **Controller (`js/Controller.js`)**: The bridge that parses input, handles events, manages mode states, and coordinates synchronization.

### Stack
-   **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3.
-   **Styling**: TailwindCSS (Utility-first framework).
-   **Data Processing**: [SheetJS (XLSX.js)](https://sheetjs.com/) for Excel parsing.
-   **Graphics**: [html2canvas](https://html2canvas.hertzen.com/) for generating high-fidelity UI captures.
-   **Icons**: [Lucide](https://lucide.dev/) for consistent vector iconography.

---

## 🚀 Getting Started

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/MIHMahmudEli/RoutinePro.git
    ```
2.  **Run Locally**:
    Simply open `index.html` in any modern browser. No build steps or servers are required for the client-side experience.

### Updating Data
1.  Navigate to the **Sync Manager** (Cloud icon in header).
2.  Select your university's Excel file.
3.  The app will rebuild its local database and UI instantly.

---

## 🔐 Admin Controls
Admin features are hidden by default. Access them by appending `?admin=true` to the URL. authentication is required to:
-   Sync course data to the global cloud database.
-   Update global Ramadan timing mappings.
-   Monitor system metadata.

---

Built with ❤️ by **Mahmud Eli** for students who value their time and aesthetics.
