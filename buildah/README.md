## fio workload container image
To build the container image, simply run the script
```
> ./buildfio.sh
```

The script uses buildah to compose the image, and is based on alpine to keep the image size as small as possible.  

Once built, tag the image and upload to docker.io

