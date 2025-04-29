FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Python and pip (if not already present)
RUN apt-get update && apt-get install -y python3 python3-pip

# Install Apprise
RUN pip3 install apprise

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 