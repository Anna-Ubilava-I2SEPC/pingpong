module.exports = {
  apps: [
    {
      name: "ping-pong-backend",
      cwd: "./server",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "ping-pong-frontend",
      cwd: "./client",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
