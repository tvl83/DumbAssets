FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Python 3 and pip for Alpine, and create a virtual environment
RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/venv && \
    rm -rf /var/cache/apk/*

# Activate virtual environment and install apprise
RUN . /opt/venv/bin/activate && \
    pip install --no-cache-dir apprise && \
    find /opt/venv -type d -name "__pycache__" -exec rm -r {} +

# Add virtual environment to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 