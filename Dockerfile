FROM nginx:alpine

# Copy a minimal nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static site files
COPY index.html impressum.html privacy.html refunds.html terms.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]