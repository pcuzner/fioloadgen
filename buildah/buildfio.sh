#!/usr/bin/bash
# use buildah to create a container holding fio
TAG=$1
IMAGE="alpine:latest"

if [ -z "${TAG}" ]; then
  TAG="latest"
fi

echo "Using tag ${TAG}"

container=$(buildah from $IMAGE)
#mountpoint=$(buildah mount $container)
buildah run $container apk add fio
buildah run $container apk add bash
buildah run $container apk add sysstat
buildah run $container apk add iperf
buildah run $container apk add rsync
#buildah run $container apk add prometheus-node-exporter --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing/
buildah run $container apk add s3cmd --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing/


buildah run $container mkdir -p /fio/jobs
buildah run $container mkdir /reports
buildah copy $container ./startup.sh /startup.sh
buildah copy $container ./startfio /usr/bin/startfio

buildah run $container chmod u+x /startup.sh
# expose port
buildah config --port 8765 $container

# set working dir
#buildah config --workingdir /usr/share/grafana $container



# entrypoint
buildah config --entrypoint "/startup.sh" $container

# finalize
buildah config --label maintainer="Paul Cuzner <pcuzner@redhat.com>" $container
buildah config --label description="fio client/server" $container
buildah config --label summary="fio client/server container - uses environment var MODE=server|client" $container
buildah commit --format docker --squash $container fiotester:$1

