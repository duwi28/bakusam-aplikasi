@echo off
echo 🚀 Setting up GitHub repository for Bakusam App...

echo 📁 Initializing Git repository...
git init

echo 📝 Adding all files...
git add .

echo 💾 Making initial commit...
git commit -m "Initial commit: Bakusam ojek online app

- Backend: Node.js + Express + Supabase
- Frontend: React + Tailwind CSS  
- Real-time: Socket.io integration
- Maps: OpenStreetMap integration
- Features: User auth, booking, driver management"

echo 🔗 Adding remote origin...
echo Please enter your GitHub username:
set /p username=
git remote add origin https://github.com/%username%/bakusam-app.git

echo 🚀 Pushing to GitHub...
git push -u origin main

echo ✅ Setup complete! Your repository is now on GitHub.
echo 🌐 Visit: https://github.com/%username%/bakusam-app
pause 