FROM node:20-slim

# Install ffmpeg for audio processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

# Port 7860 is required for Hugging Face Spaces
EXPOSE 7860

CMD ["npm", "run", "start"]
