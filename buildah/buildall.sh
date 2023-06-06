#!/usr/bin/bash
# requires bash 4.2 or above

VERSION="1.6"
SHORTID=$(git rev-parse HEAD | head -c 8)
IMAGE_TAG="${VERSION}-${SHORTID}"

CONTAINER_REPO="docker.io"
CONTAINER_ORG="${CONTAINER_REPO}/pcuzner"


if [ ! -z "$1" ]; then
  IMAGE_TAG=$1
fi

echo -e "\nBuilding containers with tag: ${IMAGE_TAG}\n"
read -p "Press enter when you've logged in to ${CONTAINER_REPO}"

echo "Building the fioservice"
OUT=$(./buildfioservice.sh $IMAGE_TAG)
readarray -t build_output <<<"$OUT"
image_id=${build_output[-1]}
image_name="${CONTAINER_ORG}/fioservice:${IMAGE_TAG}"

echo -e "\nTagging"
podman tag ${image_id} ${image_name}

echo -e "\nPushing to ${CONTAINER_REPO}"
podman push ${image_name}

echo -e "\nBuilding the fio worker container"
OUT=$(./buildfio.sh $IMAGE_TAG)
readarray -t build_output <<<"$OUT"
image_id=${build_output[-1]}
image_name="${CONTAINER_ORG}/fiotester:${IMAGE_TAG}"

echo -e "\nTagging"
podman tag ${image_id} ${image_name}

echo -e "\nPushing to ${CONTAINER_REPO}"
podman push ${image_name}

echo -e "\n\nComplete"
