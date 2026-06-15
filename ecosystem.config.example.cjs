/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "beszel-pub",
      cwd: "/path/to/beszel-pub",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      // Optional: PM2 5.3+ — load .env into the process (still keep cwd at project root)
      // env_file: ".env",
    },
  ],
};
