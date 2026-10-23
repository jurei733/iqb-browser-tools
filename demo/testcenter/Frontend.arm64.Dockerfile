FROM --platform=linux/amd64 iqbberlin/testcenter-frontend:19.0.1@sha256:d59153e9bd7fbc062dcd3154bdb932156b7d485be28f34d9cc661ca37fbfc02d AS original
FROM nginxinc/nginx-unprivileged:stable
COPY --chown=nginx:root --from=original /usr/share/nginx/html /usr/share/nginx/html
COPY --chown=nginx:root --from=original /etc/nginx/templates/default.conf.template /etc/nginx/templates/default.conf.template
