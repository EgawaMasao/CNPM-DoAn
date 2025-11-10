# Use a specific version of the Node.js slim image
FROM node:18.16.0-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build arguments for React environment variables
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ARG REACT_APP_ORDER_SERVICE_URL
ARG REACT_APP_PAYMENT_SERVICE_URL
ARG REACT_APP_AUTH_SERVICE_URL

# Set environment variables for build time
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_ORDER_SERVICE_URL=$REACT_APP_ORDER_SERVICE_URL
ENV REACT_APP_PAYMENT_SERVICE_URL=$REACT_APP_PAYMENT_SERVICE_URL
ENV REACT_APP_AUTH_SERVICE_URL=$REACT_APP_AUTH_SERVICE_URL

# # Set environment variables file
# ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]