# ExamGen AI 🎓✨

**ExamGen AI** is a powerful React-based application designed to streamline the process of creating, digitizing, and managing school exam papers. It leverages Artificial Intelligence (Gemini Pro Vision) to analyze handwritten or printed exam drafts and automatically converts them into structured, professionally formatted digital exam papers.

<div align="center">
  <img src="https://via.placeholder.com/1200x475.png?text=ExamGen+AI+Dashboard" alt="ExamGen AI Dashboard" width="100%" />
</div>

## 🚀 Key Features

*   **AI-Powered Analysis**: Upload photos of handwritten exam drafts, and the AI (Google Gemini 2.5 Pro) automatically extracts text, tables, diagrams, and structure into a digital format.
*   **Automatic Formatting**: Generates standard exam layouts including:
    *   Multiple Choice Questions (MCQs)
    *   Match the Following
    *   Grid/Box Answers
    *   Vertical Math Problems
    *   Reading Passages & Diagrams
*   **Visual Generation**: Integrated with **Pollinations AI** to generate vector-style line art for educational illustrations automatically based on question context.
*   **Cloud Sync**: Authenticated users can save their exam papers to the cloud (Supabase) and access them from any device.
*   **Local Persistence**: Auto-saves your current work to the browser's local storage so you never lose progress.
*   **Interactive Editing**:
    *   Drag-and-drop reordering of questions.
    *   Redraw AI images on demand.
    *   Edit school details and configuration in real-time.
*   **Export Options**:
    *   **PDF**: Print-ready high-fidelity output.
    *   **JSON**: Download the raw structured data for backup or portability.

## 🛠 Tech Stack

*   **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI Models**:
    *   [Google Gemini API](https://ai.google.dev/) (Text & Structure Analysis)
    *   [Pollinations.ai](https://pollinations.ai/) (Image Generation)
*   **Backend / Auth**: [Supabase](https://supabase.com/) (Auth, Database, Storage)

## 📋 Prerequisites

Ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   npm (v9 or higher)

## ⚙️ Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/examgen-ai.git
    cd examgen-ai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory and add your API keys:

    ```env
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    The app will launch at `http://localhost:5173`.

## 📖 Usage Guide

1.  **Login**: Sign in using your email (Magic Link via Supabase).
2.  **Configure Paper**: Enter school details (Name, Class, Subject, Time, Marks) in the sidebar. Upload your school logo.
3.  **Upload Drafts**:
    *   Take clear photos of your handwritten exam questions.
    *   Upload them in the "Upload Handwriting" section.
    *   Click **Generate Paper**.
4.  **Review & Edit**:
    *   The AI will generate the digital version on the right.
    *   **Reorder**: Drag and drop questions to rearrange them.
    *   **Images**: If a diagram is incorrect, click "Redraw" to generate a new variation.
5.  **Export**:
    *   Click **Save as PDF** to print or save the final document.
    *   Click **Save** (Cloud) to store it in your database for later.

## 🏗 Architecture

The project follows a clean, component-based architecture:

```
src/
├── components/       # UI Components (FileUpload, PaperRenderer)
├── hooks/            # Custom Hooks (useAuth, useLocalStorage)
├── lib/              # Library configurations (Supabase client)
├── services/         # External services (Gemini AI integration)
├── types.ts          # TypeScript interfaces and data models
├── App.tsx           # Main Application Container
└── main.tsx          # Entry Point
```

*   **`useAuth`**: Manages user sessions and authentication state.
*   **`useLocalStorage`**: Handles persistent local state with cross-tab synchronization.
*   **`PaperRenderer`**: The core component that transforms JSON exam data into a visual, printable exam paper.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
