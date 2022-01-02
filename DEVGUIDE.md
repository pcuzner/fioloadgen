
## DEV Notes

Getting your environment ready...TODO


### Testing the UI
To test the front end, first ensure your webservice is running (this will sit on port 8080), then run the code under the dev server (normally on 8081)

```
./fioservice.py --mode=debug start
```
This will run the service in the foreground running on port 8080, so you can follow any debug messages emitted.

```
cd react/app
npm start
```

**Note**: your `dist` directory will need the main `index.html` file, and the `dist/css` directory must contain the css files referenced by `index.html`.

This will start the npm dev server (by default on 8080, but since we already have our api on 8080 the dev server is on 8081).
Point your browser at http://localhost:8081


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
cp react/app/dist/bundle.js www/
cp react/app/dist/css/style.css www/css/
```

Stop the fioservice, and restart.


## Niggles
When using npm start, if you see "X-Content-Type-Options: nosniff" errors against the patternfly file, check that
it is in the dist folder. If not, copy it there and refresh your browser.

