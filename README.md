# 🚀 AI Job Application Agent

An AI-powered job application platform designed to help candidates streamline their job search, manage applications, analyze resumes, and discover relevant career opportunities.

## 📌 Overview

**AI Job Application Agent** aims to simplify the job search process by combining web technologies, AI-powered resume analysis, and personalized job recommendations in one platform.

The project includes a web-based user interface, a backend API, and a Python-based recommendation module to support intelligent job matching.

## ✨ Key Features

- **🔐 User Authentication** — Secure user sign-up and login.
- **📄 Resume Management** — Upload and manage resumes.
- **🤖 AI-Powered Resume Analysis** — Extract and analyze relevant candidate information.
- **💼 Job Discovery** — Explore job opportunities based on candidate profiles.
- **🎯 Personalized Recommendations** — Match candidates with relevant job opportunities.
- **📊 Application Tracking** — Organize and track job applications.
- **⭐ Saved Jobs** — Save interesting opportunities for later.
- **👤 Candidate Profile** — Manage personal details, skills, education, and experience.
- **☁️ Cloud Resume Storage** — Cloudinary integration for resume storage.
- **📱 Responsive Interface** — A user interface designed for different screen sizes.

*Feature availability depends on the current implementation and configuration of the project.*

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Additional Frontend | React, Vite, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Authentication | Firebase / Supabase components |
| AI Integration | Google Gemini |
| File Storage | Cloudinary |
| Recommendation Engine | Python, scikit-learn |
| Version Control | Git, GitHub |

## 📂 Project Structure

```text
ai-job-application-agent/
├── app/                    # Next.js application
├── components/             # Shared UI components
├── lib/                    # Authentication and Supabase utilities
├── client/                 # React + Vite frontend
├── server/                 # Express backend API
│   ├── src/
│   │   ├── agents/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── test/
├── ml/                     # Python recommendation modules
├── package.json
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

Install the following tools before running the project:

- [Node.js](https://nodejs.org/)
- npm
- [Git](https://git-scm.com/)
- Python and pip (for the ML module)
- MongoDB Atlas or a compatible MongoDB database
- Required Firebase, Cloudinary, and AI service credentials

### 1. Clone the Repository

```bash
git clone https://github.com/khushi1119/ai-job-application-agent.git
cd ai-job-application-agent
```

### 2. Install Dependencies

Install root dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

Install backend dependencies:

```bash
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create local environment files using the example files provided in the repository.

**Frontend (`client/.env`)**

Configure the required Vite environment variables, such as the API base URL and Firebase client configuration.

**Backend (`server/.env`)**

Configure the required server-side values, including:

- MongoDB connection URI
- Firebase Admin credentials
- Cloudinary credentials
- Google Gemini API key
- Frontend URL and CORS settings

Use the corresponding `.env.example` files as references.

> **Security:** Never commit actual API keys, passwords, service-account credentials, or production secrets to GitHub. Keep them in local environment files or your deployment platform's environment settings.

### 4. Run the Application

Start the Vite frontend:

```bash
cd client
npm run dev
```

Start the backend in a separate terminal:

```bash
cd server
npm run dev
```

Start the root Next.js application separately, if it is the frontend you intend to use:

```bash
npm run dev
```

Check each folder's `package.json` for the available scripts and configuration.

## 🧠 Machine Learning Module

The `ml/` directory contains Python-based recommendation modules intended to support job matching and recommendation workflows.

Install its dependencies from the project root:

```bash
python -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the requirements:

```bash
pip install -r ml/requirements.txt
```

The ML module may require additional configuration depending on how it is integrated with the backend.

## 🚀 Deployment

The project can be deployed using separate services for its frontend and backend.

- **Frontend:** Vercel
- **Backend API:** Render or another Node.js hosting platform
- **Database:** MongoDB Atlas
- **Resume Storage:** Cloudinary

Before deployment:

1. Choose the frontend application that will serve as the production UI.
2. Configure production environment variables.
3. Set the correct frontend API URL.
4. Configure backend CORS and authentication settings.
5. Verify database connectivity and external service credentials.
6. Test the production build and important user workflows.

Deployment configuration may vary depending on which frontend entry point is selected.

## 🔒 Security

- Keep credentials and secrets out of source control.
- Validate uploaded files and user input.
- Use authentication and authorization for protected routes.
- Configure production CORS origins explicitly.
- Store sensitive configuration in environment variables.
- Avoid exposing server-side API keys in frontend code.

## 🧪 Testing

The repository includes frontend and backend test files.

Run the test commands defined in the relevant `package.json` files. Ensure the required environment variables and test configuration are available before running integration tests.

## 🎯 Project Goals

- Simplify job discovery and application management.
- Help candidates present their skills and experience effectively.
- Support personalized job recommendations.
- Explore practical applications of AI in recruitment workflows.
- Build a modular, maintainable, and deployable web application.

## 🔮 Future Enhancements

- Advanced resume-to-job matching.
- Automated job application assistance.
- Improved recommendation ranking.
- Application status analytics.
- Enhanced candidate profile insights.
- Additional integrations with job platforms.

## 👩‍💻 Author

**Khushi Tiwari**

GitHub: [@khushi1119](https://github.com/khushi1119)

## 📄 License

No license has been specified yet. Add a `LICENSE` file if you intend to distribute the project under an open-source license.

---

⭐ If you find this project useful, consider giving the repository a star!
