
## DEV Notes

### Testing the UI
To test the front end, first ensure your webservice is running (this will sit on port 8080), then run the code under the dev server (normally on 8081)

```
./fioservice.py start --debug-only
cd react/app
npm start
```

### Building the components for cherrypy
Once your changes have been tested, you need to rebuild the artifacts that cherrypy serves.  
```
cd react/app
npm run-script build
```
this places the updated and compiled content into the react/app/dist directory

Promote the build to the live location where cherrypy picks it up from
```
cd ../..
rm -fr www/*
cp -r react/app/dist/* www
```  

Stop the fioservice, and restart.



