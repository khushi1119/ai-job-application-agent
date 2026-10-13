# 🚀 AI Job Application Agent

An AI-powered platform designed to simplify the job search process through resume analysis, personalized job recommendations, and job application tracking.

## 📌 Overview

AI Job Application Agent brings essential job-search tools together in one platform. It combines a React-based frontend, a Node.js backend, and Python-based recommendation modules to support a more organized job-search experience.

## ✨ Features

- 🔐 User authentication and account management
- 📄 Resume upload and management
- 🤖 AI-assisted resume analysis
- 💼 Job discovery and filtering
- 🎯 Personalized job recommendations
- 📊 Job application tracking
- ⭐ Saved jobs
- 👤 Candidate profile management
- ☁️ Cloudinary integration for resume storage
- 📱 Responsive user interface

*Feature availability depends on the current implementation and service configuration.*

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Authentication | Firebase and configured auth services |
| AI Integration | Google Gemini |
| File Storage | Cloudinary |
| Recommendation Module | Python, scikit-learn |
| Version Control | Git and GitHub |

## 📂 Project Structure

```text
ai-job-application-agent/
├── client/                 # React + Vite frontend
├── server/                 # Express backend API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── test/
├── ml/                     # Python recommendation modules
├── app/                    # Additional Next.js files
├── components/             # Shared/auth UI files
├── lib/                    # Authentication utilities
├── package.json
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- Python and pip for the ML module
- MongoDB Atlas or a compatible MongoDB database
- Required Firebase, Cloudinary, and Google Gemini credentials

### 1. Clone the Repository

```bash
git clone https://github.com/khushi1119/ai-job-application-agent.git
cd ai-job-application-agent
```

### 2. Start the Frontend

Open a terminal and run:

```bash
cd client
npm install
npm run dev
```

Open the local URL shown in your terminal, usually `http://localhost:5173`.

### 3. Start the Backend

Open a second terminal from the project root:

```bash
cd server
npm install
npm run dev
```

Configure the required backend environment variables before starting the server. Check `server/package.json` for the available scripts.

### 4. Configure Environment Variables

Use the provided example files as references:

- `client/.env.example`
- `server/.env.example`

Add the required frontend API URL and Firebase configuration to the frontend environment. Configure MongoDB, Firebase Admin, Cloudinary, Gemini, and CORS settings on the backend as required.

**Security:** Never commit actual API keys, passwords, or service-account credentials to GitHub.

## 🧠 Machine Learning Module

The `ml/` directory contains Python-based recommendation modules.

Create a virtual environment from the project root:

```bash
python -m venv .venv
```

On Windows, activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r ml/requirements.txt
```

Additional configuration may be required depending on how the ML module connects to the backend.

## 🚀 Deployment

The proposed deployment setup is:

- **Frontend:** Vercel — Root Directory: `client`
- **Backend:** Render — Root Directory: `server`
- **Database:** MongoDB Atlas
- **Resume Storage:** Cloudinary

Before deploying, configure the production API URL, environment variables, CORS origins, database access, and authentication settings. Verify the build and test the main user workflows.

## 🔒 Security

- Keep API keys and credentials private.
- Validate uploaded files and user input.
- Protect authenticated routes.
- Configure CORS for trusted origins.
- Store production secrets in the hosting platform's environment settings.

## 🎯 Project Goals

- Simplify job discovery and application management.
- Help candidates organize their resumes and profiles.
- Support relevant job recommendations.
- Explore practical applications of AI in recruitment.
- Build a maintainable and deployable application.

## 🔮 Future Enhancements

- Improved resume-to-job matching
- More advanced recommendation ranking
- Application analytics
- Enhanced candidate insights
- Additional job-platform integrations

## 👩‍💻 Author

**Khushi Tiwari**

GitHub: [@khushi1119](https://github.com/khushi1119)

## 📄 License

No license has been specified yet. Add a `LICENSE` file if you intend to distribute this project under an open-source license.

---

⭐ If you find this project useful, consider giving the repository a star!
