# SoloVoyage: The Ultimate Solo Travel Safety Guide

Welcome to the SoloVoyage project repository. This project is a modern, responsive, multi-page website designed to provide a comprehensive safety guide for solo travelers. It contains 101 detailed tips organized into logical categories, a full summary checklist, and is built with modern web technologies for a smooth, animated user experience.

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [Live Demo](#live-demo)
3.  [Features](#features)
4.  [Tech Stack](#tech-stack)
5.  [File Structure](#file-structure)
6.  [Setup and Usage](#setup-and-usage)
7.  [Content Sources](#content-sources)

---

### 1. Project Overview

SoloVoyage aims to be the definitive online resource for solo travel safety. Recognizing that solo travel requires a heightened sense of awareness, this guide empowers travelers with actionable advice. The content covers everything from pre-trip planning and packing to on-the-ground safety, digital security, and emergency preparedness. The website is designed to be easily navigable, with a clean, dark-mode interface that makes the detailed information digestible and engaging.

---

### 2. Live Demo

*A live version of this website can be viewed here: [Live Demo](https://satyam2003-dev.github.io/SoloVoyage/)*

---

### 3. Features

-   **Fully Responsive Design:** Adapts seamlessly to desktops, tablets, and mobile devices.
-   **Multi-Page Architecture:** Content is split into 11 distinct, easy-to-navigate pages, preventing user overload.
-   **Sticky Navigation Bar:** The header with dropdown menus remains visible at all times for easy access to all sections.
-   **Smooth Scroll Animations:** Subtle fade-in animations on content cards using the Animate On Scroll (AOS) library enhance the user experience.
-   **Modern UI/UX:** A clean, dark-themed design with a professional color palette and typography for excellent readability.
-   **Detailed, Comprehensive Content:** Features the full, unabridged text for all 101 safety tips, ensuring no detail is lost.
-   **Dedicated Checklist Page:** A scannable, multi-column checklist provides a quick summary of the most critical actions for users.

---

### 4. Tech Stack

-   **HTML5:** For the core structure and content.
-   **Tailwind CSS:** A utility-first CSS framework for rapid and responsive UI development.
-   **Custom CSS:** For advanced styling, animations, and visual enhancements not covered by Tailwind (`/assets/css/main.css`).
-   **JavaScript (ES6):** For interactive elements like the mobile menu, sticky header effects, and initializing the AOS library (`/assets/js/main.js`).
-   **Animate On Scroll (AOS):** A lightweight JavaScript library for scroll animations.

---

### 5. File Structure

The project is organized logically to separate content, styles, and scripts.

```
/SoloVoyage/
|
|-- index.html                 # Home Page
|-- pre-trip-foundation.html   # Tips 1-10
|-- packing-preparation.html   # Tips 11-20
|-- transportation-safety.html # Tips 21-30
|-- accommodation-safety.html  # Tips 31-40
|-- daily-exploration.html     # Tips 41-50
|-- money-valuables.html       # Tips 51-60
|-- digital-safety.html        # Tips 61-70
|-- food-drink-safety.html     # Tips 71-80
|-- social-safety.html         # Tips 81-90
|-- emergency-response.html    # Tips 91-101
|-- checklist.html             # Full checklist summary page
|-- README.md                  # This file
|
|-- /assets/
|   |-- /css/
|   |   |-- main.css           # All custom styles
|   |-- /js/
|   |   |-- main.js            # All JavaScript functionality
|   |-- /images/
|   |   |-- night_camping.jpg  # Example image file
```

---

### 6. Setup and Usage

This is a static website and requires no complex setup.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Satyam2003-dev/SoloVoyage.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd SoloVoyage
    ```
3.  **Open `index.html` in your browser:**
    Simply open the `index.html` file in a web browser (like Chrome, Firefox, or Safari) to view the website locally. All assets are linked relatively, so no web server is required for local viewing.

---

### 7. Content Sources

All content, including the 101 detailed tips and the summary checklist, was provided as part of the project's requirements. The focus of this repository is on the design, structure, and implementation of this content into a modern, user-friendly website.
