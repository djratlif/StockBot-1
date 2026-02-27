FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app to ensure it compiles, then run development server
EXPOSE 3000
CMD ["npm", "start"]
