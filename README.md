# 🗓️ RoutinePro: Next-Gen Course Architect

RoutinePro is a high-performance, aesthetically stunning web application designed to solve the complex puzzle of university course scheduling. Built with a focus on **Glassmorphism UI** and **Dynamic Logic**, it allows students to generate thousands of possible routine scenarios in seconds.

![RoutinePro Preview](preview.svg)

## ✨ Core Features

- **🚀 Instant Generation**: Scans thousands of course combinations to find valid, conflict-free routines.
- **📊 Dynamic XLSX/JSON Upload**: Directly upload your university's "Offered Course Report" to update the local database.
- **🧠 Smart Semester Detection**: Automatically identifies the semester (e.g., SPRING 2024-25) from file metadata and sheet names.
- **🎨 Prism UI System**: A premium glassmorphic interface with support for multiple themes (Emerald, Rose, Amber, etc.).
- **🏷️ Strict Status Filtering**: Filter sections by status (Open, Reserved, Freshman, etc.) to only see seats you can actually take.
- **📸 Export to Image**: Save your perfect routine as a high-quality PNG for quick reference.
- **📱 Responsive by Design**: Fully optimized for Desktop, Tablet, and Mobile devices.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, JavaScript (ES6+), TailwindCSS.
- **Design**: Premium Glassmorphism (Backdrop-filters, Sleek Gradients).
- **Libraries**:
  - `SheetJS (XLSX)`: Robust Excel data processing.
  - `Lucide Icons`: Clean, consistent iconography.
  - `html2canvas`: High-fidelity routine exports.
  - `TailwindCSS`: Atomic utility styling.

## 🚀 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MIHMahmudEli/RoutinePro.git
   ```
2. **Open `index.html`**:
   Simply open the file in any modern browser—no server setup required!
3. **Sync Data**:
   - Open the **Sync Manager** (Cloud icon).
   - Upload your `Offered Course Report.xlsx`.
   - RoutinePro will automatically detect the semester and load all courses.

## 🌈 Theming Engine

RoutinePro features a dynamic theming system. Change the `data-theme` attribute to switch between:
- `emerald` (Default Green)
- `rose` (Warm Pink)
- `amber` (Gold)
- `indigo` (Deep Blue)
- `spectrum` (Multi-color unique IDs)

## 🤝 Contributing

Contributions are what make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---
Built with ❤️ for students who value their time.
