FROM node:20-alpine
WORKDIR /app
COPY dashboards/web /usr/share/web
EXPOSE 8080
CMD ["npx", "--yes", "serve", "-l", "8080", "/usr/share/web"]
