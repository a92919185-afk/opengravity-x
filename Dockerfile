FROM node:20-slim

# Install system dependencies
# - python3/pip for browser-use (Python library)
# - ffmpeg for audio
# - libnss3, libatk, etc. for Chromium/Playwright
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install browser-use (Python) and Playwright
# We install globally or in a way the node app can call 'browser-use' command
RUN pip3 install --break-system-packages browser-use playwright
RUN playwright install chromium
RUN playwright install-deps chromium

# Install node dependencies
COPY package*.json ./
RUN npm install

# Copy everything and build
COPY . .
RUN npm run build

# Port 10000 is default for Render
EXPOSE 10000

# Start
CMD ["node", "dist/index.js"]
