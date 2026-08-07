FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy shared libraries
COPY libs/ ./libs/

# Accept build arg for which service to build
ARG SERVICE_NAME
COPY apps/${SERVICE_NAME}/ ./apps/${SERVICE_NAME}/

# Install dependencies
RUN npm ci --omit=dev

# Set working directory to the service
WORKDIR /app/apps/${SERVICE_NAME}

EXPOSE 8000

CMD ["node", "src/main.js"]
