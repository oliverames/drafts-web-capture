# Use official Node.js Alpine image for lightweight container
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install --production

# Copy all source files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Command to run the application
CMD ["node", "src/server.js"]