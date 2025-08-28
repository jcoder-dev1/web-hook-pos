module.exports = {
  apps: [
    {
      name: "pos-web-hook", // Changed to match the name used in build.yml
      script: "dist/main.js",
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3002
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      // Optional settings for better process management
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 8000
    }
  ]
};