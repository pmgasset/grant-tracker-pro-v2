# 🎯 Grant Tracker Pro

> **AI-Powered Grant Discovery & Management Platform**
> 
> Streamline your nonprofit's grant tracking with intelligent search, automated discovery, and seamless management - all powered by Cloudflare's edge network.

![Grant Tracker Pro](https://img.shields.io/badge/Powered%20by-Cloudflare-orange?style=for-the-badge)
![React](https://img.shields.io/badge/React-18+-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0+-06B6D4?style=for-the-badge&logo=tailwindcss)

## ✨ Features

- 🔍 **AI-Powered Grant Search** - Intelligent discovery using Cloudflare Workers
- 📊 **Real-time Dashboard** - Track applications, deadlines, and funding status
- 🌐 **Offline-First Design** - Works without internet using cached data
- 💾 **Cloudflare Storage** - Data synced across devices using KV and D1
- 📱 **Responsive Design** - Perfect on desktop, tablet, and mobile
- ⚡ **Lightning Fast** - Edge-optimized for global performance
- 🔒 **Secure & Private** - Enterprise-grade security with Cloudflare

## 🚀 Quick Start with GitHub Desktop

### Prerequisites

- **GitHub Desktop** - [Download here](https://desktop.github.com/)
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Free Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)

### Step 1: Clone with GitHub Desktop

1. **Open GitHub Desktop**
2. **File → Clone repository from the Internet**
3. **URL:** `https://github.com/yourusername/grant-tracker-pro.git`
4. **Local path:** Choose where to save the project
5. **Click "Clone"**

### Step 2: Set Up the Project

1. **Open Terminal in GitHub Desktop:**
   - Repository → Open in Terminal (or Command Prompt on Windows)

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set Up Environment:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** with your settings (see Configuration section below)

### Step 3: Cloudflare Setup (Free Tier)

#### 3.1 Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

#### 3.2 Create Cloudflare Services

**KV Storage (Free: 1GB):**
```bash
wrangler kv:namespace create "GRANTS_KV"
wrangler kv:namespace create "GRANTS_KV" --preview
```

**D1 Database (Free: 5GB):**
```bash
wrangler d1 create grant-tracker-db
```

**Update wrangler.toml** with the IDs returned from above commands.

#### 3.3 Deploy Workers
```bash
npm run workers:deploy
```

### Step 4: Deploy Frontend to Cloudflare Pages

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Connect to Cloudflare Pages:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Pages → Create a project
   - Connect to Git → Select your repository
   - Build settings:
     - **Build command:** `npm run build`
     - **Build output directory:** `dist`

3. **Deploy automatically** - Every push to main branch will auto-deploy!

## 🛠️ Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# In a separate terminal, start Cloudflare Workers
npm run workers:dev
```

### Using GitHub Desktop for Development

1. **Make changes** to your code
2. **GitHub Desktop** will show all changes
3. **Write a commit message** describing your changes
4. **Commit to main** (or create a new branch)
5. **Push origin** to deploy automatically

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run workers:dev` | Start Cloudflare Workers locally |
| `npm run workers:deploy` | Deploy Workers to Cloudflare |
| `npm run deploy` | Build and deploy everything |

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Required
VITE_APP_NAME="Grant Tracker Pro"
VITE_CLOUDFLARE_ACCOUNT_ID=your_account_id

# Optional
VITE_GRANTS_GOV_API_KEY=your_api_key
VITE_ENABLE_ANALYTICS=true
```

### Cloudflare Services Configuration

#### KV Namespaces
- **Production:** `GRANTS_KV`
- **Preview:** `GRANTS_KV_PREVIEW`

#### D1 Database
- **Name:** `grant-tracker-db`
- **Tables:** Automatically created on first use

#### Workers Routes
- `/api/search-grants` → Grant search functionality
- `/api/save-grants` → Data persistence
- `/api/load-grants` → Data retrieval

## 📱 Features Overview

### Dashboard
- **Funding Overview** - Total awarded, pending applications
- **Deadline Tracking** - Urgent deadlines and upcoming dates
- **Activity Feed** - Recent grant activities and updates
- **Status Analytics** - Visual breakdown of grant statuses

### Grant Search
- **AI-Powered Discovery** - Intelligent grant matching
- **Advanced Filters** - Category, amount, location, funder type
- **Real-time Results** - Powered by Cloudflare Workers
- **Source Verification** - Trusted grant databases and foundations

### Grant Management
- **Status Tracking** - Research, Applied, Awarded, Rejected
- **Document Management** - Requirements and application materials
- **Deadline Monitoring** - Automated reminders and alerts
- **Progress Analytics** - Success rates and application insights

## 🌐 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │────│ Cloudflare      │────│ External APIs   │
│  (Pages)        │    │ Workers         │    │ (Grants.gov,    │
│                 │    │                 │    │ Foundations)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       
         │                       │                       
┌─────────────────┐    ┌─────────────────┐              
│ Cloudflare KV   │    │ Cloudflare D1   │              
│ (Cache/Session) │    │ (Persistent)    │              
└─────────────────┘    └─────────────────┘              
```

## 📋 Project Structure

```
grant-tracker-pro/
├── src/
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript definitions
│   ├── utils/              # Utility functions
│   └── App.tsx             # Main application
├── functions/              # Cloudflare Workers
│   ├── search-grants.ts    # Grant search API
│   └── save-grants.ts      # Data persistence API
├── public/                 # Static assets
├── wrangler.toml          # Cloudflare configuration
└── package.json           # Dependencies and scripts
```

## 🔧 Customization

### Adding New Grant Sources
1. **Edit** `functions/search-grants.ts`
2. **Add** new search function
3. **Deploy** workers: `npm run workers:deploy`

### Styling
- **Tailwind CSS** - Modify `tailwind.config.js`
- **Custom CSS** - Edit `src/App.css`
- **Components** - Update individual component styles

### Data Storage
- **KV Storage** - For fast, global access
- **D1 Database** - For complex queries and relationships
- **Local Storage** - Fallback for offline mode

## 🚦 Deployment

### Automatic Deployment (Recommended)
- **Push to GitHub** → **Auto-deploy to Cloudflare Pages**
- **Zero downtime** deployments
- **Preview deployments** for pull requests

### Manual Deployment
```bash
# Deploy everything
npm run deploy

# Deploy only Workers
npm run workers:deploy

# Deploy only frontend
npm run build && wrangler pages deploy dist
```

## 📊 Analytics & Monitoring

### Cloudflare Analytics
- **Page views and performance**
- **Error tracking and debugging**
- **User engagement metrics**

### Custom Metrics
- **Grant search performance**
- **User application success rates**
- **API response times**

## 🔒 Security

### Data Protection
- **Client-side encryption** for sensitive data
- **Cloudflare security** protections
- **No server maintenance** required

### Privacy
- **No user tracking** by default
- **Data stored on Cloudflare edge**
- **GDPR compliant** options available

## 🆘 Troubleshooting

### Common Issues

**Build fails:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Workers not deploying:**
```bash
# Check Wrangler authentication
wrangler whoami
wrangler login
```

**Search not working:**
- Check KV namespace IDs in `wrangler.toml`
- Verify Workers are deployed
- Check browser console for errors

### Getting Help

1. **Check Issues** - [GitHub Issues](https://github.com/yourusername/grant-tracker-pro/issues)
2. **Cloudflare Docs** - [Cloudflare Developer Docs](https://developers.cloudflare.com/)
3. **Community** - [Cloudflare Discord](https://discord.cloudflare.com/)

## 📈 Roadmap

- [ ] **Advanced AI Search** - GPT-powered grant matching
- [ ] **Team Collaboration** - Multi-user support
- [ ] **API Integrations** - CRM and fundraising platforms
- [ ] **Mobile App** - React Native version
- [ ] **Advanced Analytics** - Success prediction models

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Cloudflare** - For amazing edge computing platform
- **React Team** - For the fantastic framework
- **Tailwind CSS** - For beautiful, utility-first styling
- **Lucide** - For clean, consistent icons

---

**Built with ❤️ by the nonprofit community, for the nonprofit community.**

[Get Started](https://grant-tracker-pro.pages.dev) | [Documentation](docs/) | [Support](mailto:support@grant-tracker-pro.com)