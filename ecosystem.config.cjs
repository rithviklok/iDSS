/**
 * PM2 ecosystem config for dss-frontend
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'dss-frontend',
      cwd: '/home/ec2-user/dss-frontend',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
    },
  ],
};
