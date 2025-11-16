# --------------------------------------------------------------------------------
# STAGE 1: Build Stage (Build production bundle)
# --------------------------------------------------------------------------------
FROM node:18.16.0-slim as build-stage

# Set working directory
WORKDIR /app

# Build arguments for React environment variables
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ARG REACT_APP_ORDER_SERVICE_URL
ARG REACT_APP_PAYMENT_SERVICE_URL
ARG REACT_APP_AUTH_SERVICE_URL
ARG REACT_APP_RESTAURANT_SERVICE_URL

# Set environment variables for build time
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_ORDER_SERVICE_URL=$REACT_APP_ORDER_SERVICE_URL
ENV REACT_APP_PAYMENT_SERVICE_URL=$REACT_APP_PAYMENT_SERVICE_URL
ENV REACT_APP_AUTH_SERVICE_URL=$REACT_APP_AUTH_SERVICE_URL
ENV REACT_APP_RESTAURANT_SERVICE_URL=$REACT_APP_RESTAURANT_SERVICE_URL

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application - THIS IS CRITICAL!
RUN npm run build

# --------------------------------------------------------------------------------
# STAGE 2: Production Stage (Serve static files)
# --------------------------------------------------------------------------------
FROM node:18.16.0-slim as production-stage

# Install serve to serve static files
RUN npm install -g serve

WORKDIR /app

# Copy build output from build-stage
COPY --from=build-stage /app/build ./build

# Expose port
EXPOSE 3000

# Serve static files
CMD ["serve", "-s", "build", "-l", "3000"]