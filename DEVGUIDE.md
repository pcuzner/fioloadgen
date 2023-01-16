
## DEV Notes

### Getting your environment ready
This example focuses on Fedora 36, but serves as an example of the overall process

ersion Goals
nodejs : 18.1.0
react: 17.0.2
webpack: 5.73


Fedora 36 / 37
Fedora Modules configuration
ref: https://developer.fedoraproject.org/tech/languages/nodejs/nodejs.html
dnf module list
dnf module install nodejs:18/development

(this will install items 1 and 3)
npm uninstall react@18
npm uninstall react-dom@18

npm install react@17.0.2 --save
npm install react-dom@17.0.2 --save

run "npm install" to process the package.json file to pull in dependencies for the project

### Testing the UI
To test the front end, first ensure your webservice is running (this will listen on port 8080). 

```
./fioservice.py --mode=debug start
```
This will run the service in the foreground running on port 8080, so you can follow any debug messages emitted.

Now, start the npm dev server to compile and present the UI on port 3000.

```
cd react/app
npm start
```

**Note**: The public directory requires the `index.html` and css files to render correctly.

Point your browser at http://localhost:3000


### Building the components for cherrypy
Once your changes have been tested, you need to rebuild the artifacts that cherrypy serves.
```
cd react/app
npm run-script build
```
This places the updated and compiled content into the react/app/build directory

To promote the build, you can either use the `deploy` script or copy the files manually from the `build` directory to `www` 
```
cd react/app
npm run-script deploy
```

Once the UI assets are in place, refresh your browser or restart the fioservice.
