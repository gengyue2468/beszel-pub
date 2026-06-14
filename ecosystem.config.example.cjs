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
    },
  ],
};
