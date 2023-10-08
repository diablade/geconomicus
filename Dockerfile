#docker build -t geco:1.0 .
FROM node:18.16.1-alpine
MAINTAINER Nicolas Markovic
COPY . .
VOLUME /logs

WORKDIR /back
RUN npm install && npm cache clean --force
ENV GECO_NODE_ENV=production \
    GECO_VERSION=0.5.2 \
    GECO_PORT_NODE=8085 \
    GECO_LOG_DEBUG=false \
    GECO_DB_CONFIG_HOSTNAME=mongodb \
    GECO_DB_CONFIG_PORT=27017 \
    GECO_DB_CONFIG_COLLECTION=geconomicus \
    GECO_DB_CONFIG_USER=admin \
    GECO_DB_CONFIG_PASSWORD=admin
    # NODE_OPTIONS="--max-old-space-size=5120"
    # Increases to 5 GB
RUN npm run cleanProd
CMD ["node","app.js"]
EXPOSE 8085
