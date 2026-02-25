FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Set handler
CMD ["src/index.handler"]
