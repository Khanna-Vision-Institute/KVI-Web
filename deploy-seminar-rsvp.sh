#!/bin/bash
# Deploy seminar-rsvp.html to production server

set -e
SSH_KEY="/Users/nisha/Desktop/khannainstitute_backup/khannainstitute.pem"
SSH_USER="ec2-user"
SSH_HOST="ec2-3-84-141-231.compute-1.amazonaws.com"
REMOTE_DIR="/home/ec2-user/kvi-home/kvi home"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying seminar-rsvp.html to ${SSH_HOST}..."
scp -i "${SSH_KEY}" "${SCRIPT_DIR}/seminar-rsvp.html" ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/

echo "Done. seminar-rsvp.html deployed."
