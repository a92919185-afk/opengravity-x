FROM node:20-slim

# Install ffmpeg for audio processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy everything and build
COPY . .
RUN npm run build

# Port 10000 is default for Render
EXPOSE 10000

# Start from the compiled dist/ directory (uses less memory than tsx)
CMD ["node", "dist/index.js"]
