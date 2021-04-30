#!/usr/bin/bash
# use buildah to create a container holding the fio web service (UI+API)

if [ ! -z "$1" ]; then
  TAG=$1
else
  TAG='latest'
fi

echo "Build image with the tag: $TAG"

IMAGE="alpine:edge"

container=$(buildah from $IMAGE)
#mountpoint=$(buildah mount $container)
buildah run $container apk add fio
buildah run $container apk add bash
buildah run $container apk add sysstat
buildah run $container apk add iperf
buildah run $container apk add rsync
buildah run $container apk add python3
buildah run $container apk add --update py3-pip

buildah run $container pip3 install --upgrade pip
buildah run $container pip3 install jaraco.collections
buildah run $container pip3 install zc.lockfile
buildah run $container pip3 install cheroot
buildah run $container pip3 install portend
buildah run $container pip3 install kubernetes
buildah run $container apk add py3-cherrypy  --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing/
buildah run $container apk add py3-more-itertools

# buildah run $container apk add py3-wheel --repository http://dl-cdn.alpinelinux.org/alpine/edge/main/

buildah run $container mkdir -p /var/lib/fioloadgen/{jobs,reports}
buildah run $container mkdir -p /var/log/fioloadgen
buildah run $container mkdir -p /var/run/fioloadgen

buildah copy $container ../data/fio/jobs/ /var/lib/fioloadgen/jobs
buildah copy $container ../fioservice /fioservice
buildah copy $container ../fiotools /fiotools
buildah copy $container ../www /www

buildah run $container chmod g+w -R /var/lib/fioloadgen
buildah run $container chmod g+w -R /var/log/fioloadgen
buildah run $container chmod g+w -R /var/run/fioloadgen

# expose port
# buildah config --port 8080 $container

# set working dir
#buildah config --workingdir /usr/share/grafana $container



# entrypoint
buildah config --entrypoint "./fioservice start" $container

# finalize
buildah config --label maintainer="Paul Cuzner <pcuzner@redhat.com>" $container
buildah config --label description="fioservice API/UI" $container
buildah config --label summary="fioservice focal point to interact with fiomgr/fioworker pods" $container
buildah commit --format docker --squash $container fioservice:$TAG
