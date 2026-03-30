# 📋 GitHub Repository Setup Instructions

## 🎯 Create GitHub Repository

### Step 1: Create New Repository on GitHub

1. **Go to GitHub**: [https://github.com/new](https://github.com/new)
2. **Repository name**: `drafts-web-capture`
3. **Description**: "Self-hosted Drafts Web Capture with CloudKit integration"
4. **Visibility**: Choose `Public` or `Private`
5. **Initialize this repository with**: ❌ **None** (don't add README, .gitignore, or license)
6. **Click "Create repository"**

### Step 2: Connect Local Repository to GitHub

```bash
# Add the remote origin (replace with your GitHub username)
git remote add origin https://github.com/your-username/drafts-web-capture.git

# Push to GitHub
git push -u origin main
```

### Step 3: Verify the Push

```bash
# Check remote connection
git remote -v

# View repository on GitHub
open https://github.com/your-username/drafts-web-capture
```

## 🔄 Alternative: Using GitHub CLI

If you have the GitHub CLI installed:

```bash
# Install GitHub CLI if needed
# brew install gh

# Authenticate
gh auth login

# Create repository
gh repo create drafts-web-capture --public --source=. --push
```

## 📋 Manual Push Instructions

If you prefer to do it manually:

```bash
# Create repository on GitHub website first
# Then run these commands:

cd /Users/oliverames/Library/Mobile\ Documents/com~apple~CloudDocs/Developer/projects/drafts-web

# Add remote (replace username)
git remote add origin https://github.com/your-username/drafts-web-capture.git

# Push to GitHub
git push -u origin main
```

## ✅ Verification

After pushing, verify:

1. **GitHub repository** shows all files
2. **README.md** is displayed properly
3. **Code structure** matches your local repository
4. **All branches** are pushed

## 🔧 Troubleshooting

### Permission denied
```bash
git remote set-url origin https://your-username@github.com/your-username/drafts-web-capture.git
```

### Repository already exists
```bash
git remote remove origin
git remote add origin https://github.com/your-username/drafts-web-capture.git
```

### Large files
```bash
# If you get errors about large files, use:
git lfs install
git lfs track "*.psd"
git add .gitattributes
```

## 🎉 Next Steps

Once your repository is on GitHub:

1. **Star the repository** for easy access
2. **Enable GitHub Pages** for documentation (optional)
3. **Set up GitHub Actions** for CI/CD (optional)
4. **Add collaborators** if working with a team

Your Drafts Web Capture is now ready to share with the world! 🚀