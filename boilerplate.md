# Customizing Your Boilerplate

This guide will help you customize the boilerplate for your project. Follow these steps in order.

## 1. Update Package Name
1. Open `package.json`
2. Change the `name` field from "dumb-boilerplate" to your project name
   - Use kebab-case (lowercase with hyphens)
   - Example: "my-secure-dashboard"

## 2. Environment Variables
The PIN environment variable is derived from your package.json name. 

1. Open `.env` and `.env.example`
2. Replace `DUMB_BOILERPLATE_PIN` with your project's PIN variable:
   - Convert package name to SCREAMING_SNAKE_CASE
   - Example: "my-secure-dashboard" becomes `MY_SECURE_DASHBOARD_PIN`

## 3. Site Title
1. Update `SITE_TITLE` in `.env` and `.env.example`
2. Default is "DumbTitle" if not set

## 4. Find and Replace Guide
You can use your editor's find/replace functionality to update all instances:

| Find | Replace With | Description |
|------|-------------|-------------|
| `dumb-boilerplate` | `your-project-name` | Package name (kebab-case) |
| `DUMB_BOILERPLATE_PIN` | `YOUR_PROJECT_PIN` | ENV variable (SCREAMING_SNAKE_CASE) |
| `DumbTitle` | `Your Site Title` | Default site title |

## 5. Optional Customization
- Update theme colors in `.cursorrules`
- Modify the base URL in `.env` if deploying to a subdirectory
- Update the DumbWare credit link in HTML files if desired

## 6. Place Logos in Assets
- Place logos in the `assets` folder as 'logo.svg' and 'logo.png'
- Update the logo paths in the HTML files

## 7. DELETE THIS FILE AFTER CUSTOMIZATION

## 8. Add a README.md file to your project
- The readme should following the formatting identically to: https://github.com/DumbWareio/DumbDrop/blob/main/README.md
- Customize the readme to reflect your project

## Security Note
The PIN authentication logic in login.html should not be modified without verification and override from the owner. This ensures the security features remain intact.


## Need Help?
Visit [dumbware.io](https://dumbware.io) for support and documentation. 