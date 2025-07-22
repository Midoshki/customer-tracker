# Deploying Customer Tracker to Dokploy VPS

This guide will help you deploy your React customer tracker application to a Dokploy VPS.

## Prerequisites

1. **Dokploy VPS Setup**: Ensure you have Dokploy installed and running on your VPS
2. **Docker**: Dokploy uses Docker for containerization
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)
4. **Supabase Credentials**: Your existing Supabase project URL and anon key

## Deployment Steps

### 1. Prepare Your Repository

Ensure these files are in your repository root:
- `Dockerfile` ✅ (created)
- `docker-compose.yml` ✅ (created)
- `nginx.conf` ✅ (created)
- `env.example` ✅ (created)

### 2. Access Dokploy Dashboard

1. Log into your Dokploy VPS dashboard
2. Navigate to the applications section

### 3. Create New Application

1. Click "Create Application" or "New Project"
2. Choose "Docker Compose" deployment type
3. Connect your Git repository containing this code

### 4. Configure Repository Settings

- **Repository URL**: Your Git repository URL
- **Branch**: `main` (or your default branch)
- **Build Context**: `/` (root directory)
- **Dockerfile Path**: `./Dockerfile`

### 5. Set Environment Variables

In the Dokploy environment variables section, add:

```
REACT_APP_SUPABASE_URL=your_actual_supabase_url
REACT_APP_SUPABASE_KEY=your_actual_supabase_anon_key
```

**Important**: Replace the values with your actual Supabase credentials from your current Vercel deployment.

### 6. Configure Domain (Optional)

If you want a custom domain:
1. Go to the "Domains" section in Dokploy
2. Add your domain name
3. Configure DNS records to point to your VPS IP

### 7. Deploy

1. Click "Deploy" or "Build & Deploy"
2. Monitor the build logs for any errors
3. Once deployed, your app will be available at your VPS IP or configured domain

## Troubleshooting

### Build Issues

If the build fails:
1. Check the build logs in Dokploy
2. Ensure all dependencies are correctly specified in `package.json`
3. Verify the Dockerfile syntax

### Runtime Issues

If the app doesn't load:
1. Check container logs in Dokploy
2. Verify environment variables are set correctly
3. Ensure Supabase URLs are accessible from your VPS

### Port Conflicts

If port 80 is already in use:
1. Modify the `docker-compose.yml` to use a different port:
   ```yaml
   ports:
     - "8080:80"  # Change 80 to 8080 or another available port
   ```

## Updating Your Application

To update your deployed application:
1. Push changes to your Git repository
2. In Dokploy, click "Redeploy" or "Pull & Deploy"
3. Monitor the deployment process

## Monitoring

- Use Dokploy's built-in monitoring to track:
  - Container status
  - Resource usage (CPU, memory)
  - Application logs
  - Uptime

## Migration from Vercel

Since you're migrating from Vercel:
1. Your Supabase configuration should work without changes
2. Update any hardcoded URLs to point to your new VPS domain
3. Consider updating your DNS records for your custom domain (if applicable)
4. Test all functionality after deployment

## Support

If you encounter issues:
1. Check Dokploy documentation
2. Review application logs in the Dokploy dashboard
3. Ensure your VPS has sufficient resources (RAM, CPU, disk space)

---

**Note**: Keep your Supabase credentials secure and never commit them to your repository. Always use environment variables for sensitive configuration. 