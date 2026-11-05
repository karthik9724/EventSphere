# 🎟️ EventSphere – College Event Management System

**EventSphere** is a full-stack MERN application designed to simplify college event management. It provides a platform where students can explore events, register for them, and manage their tickets, while coordinators and administrators can organize and manage events efficiently.

## 🌐 Live Demo

[**Visit EventSphere – Live Application**](https://eventsphere-frontend-beige.vercel.app/login)

## 📌 Project Overview

EventSphere is developed to make college event management easier and more organized. It provides separate dashboards and functionalities for Students, Coordinators, and Administrators.

The application supports event creation, event registration, ticket management, image uploads, and role-based access.

## ✨ Features

### 👨‍🎓 Student

- Student registration and login.
- Browse available college events.
- View event details and images.
- Register for events.
- Manage registered events and tickets.
- Cancel event registrations.

### 👨‍💼 Coordinator

- Coordinator login.
- Create and manage events.
- Upload event images.
- View event registrations.
- Manage event information.

### 🛡️ Admin

- Secure admin login.
- Admin dashboard.
- Manage users and events.
- Monitor event activities.
- Manage the overall platform.

### ⚙️ General Features

- Role-based authentication and authorization.
- JWT-based authentication.
- Responsive user interface.
- RESTful API integration.
- MongoDB database integration.
- Cloudinary image storage.
- Separate dashboards for different user roles.

## 🛠️ Technologies Used

| Category | Technologies |
|---|---|
| Frontend | React.js, HTML, CSS, JavaScript |
| Build Tool | Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Authentication | JSON Web Token (JWT) |
| Image Storage | Cloudinary |
| API | REST API |
| Version Control | Git, GitHub |
| Deployment | Vercel |

## 📸 Screenshots

### 🏠 Home Page

![EventSphere Home Page](screenshots/home.png)

### 🔐 Login Page

![EventSphere Login Page](screenshots/login.png)

### 👨‍🎓 Student Dashboard

![Student Dashboard](screenshots/student-dashboard.png)

### 👨‍💼 Coordinator Dashboard

![Coordinator Dashboard](screenshots/coordinator-dashboard.png)

### 🛡️ Admin Dashboard

![Admin Dashboard](screenshots/admin-dashboard.png)

## 📂 Project Structure

```text
EventSphere/
│
├── client/                  # React frontend
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── server/                  # Node.js and Express backend
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── package.json
│   └── server.js
│
├── screenshots/             # Project screenshots
│   ├── home.png
│   ├── login.png
│   ├── student-dashboard.png
│   ├── coordinator-dashboard.png
│   └── admin-dashboard.png
│
├── .gitignore
└── README.md
```

## 💻 Installation and Setup

Follow these steps to run EventSphere locally.

### 1. Clone the Repository

```bash
git clone https://github.com/karthik9724/EventSphere.git
```

### 2. Navigate to the Project

```bash
cd EventSphere
```

### 3. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder and configure the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend:

```bash
npm start
```

### 4. Setup Frontend

Open another terminal from the project root:

```bash
cd client
npm install
```

Create a `.env` file inside the `client` folder:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The application will be available at the local Vite URL displayed in your terminal, usually:

```text
http://localhost:5173
```

## 🔑 Environment Variables

The project requires the following environment variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB database connection |
| `JWT_SECRET` | JWT authentication secret |
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `VITE_API_URL` | Backend API base URL for frontend |

**Important:** Never upload `.env` files, passwords, API keys, or other secrets to GitHub.

## 🚀 Deployment

EventSphere is deployed using Vercel.

- **Frontend:** React application hosted on Vercel.
- **Backend:** Express API hosted on Vercel.
- **Database:** MongoDB Atlas.
- **Image Storage:** Cloudinary.

The frontend communicates with the backend through the configured `VITE_API_URL` environment variable.

## 🎯 Future Enhancements

- Email notifications for event registrations.
- QR code-based ticket verification.
- Event attendance tracking.
- Advanced event search and filtering.
- Event feedback and rating system.