
## DEV Notes
To test the front end, first ensure your webservice is running (this will sit on port 8080), then run the code under the dev server (normally on 8081)

```
cd react/app
npm start
```


To build the front end for production usage (i.e. code is good to go..)
```
cd react/app
npm run build
```
this places the updated and compiled content into the react/app/dist directory

Promote the build to the live location where cherrypy picks it up from
```
rm -f www/*
cd <root of project>
cp -r react/app/dist/* www
```



