
## DEV Notes
To build the front end
```
cd react/fioweb
npm run build
```
this places the updated content into the build directory

Promote the build to the live location where cherrypy picks it up from
```
cd <root of project>
cp -r react/fioweb/build/* www
```

To edit any of the base html (title etc)
- react/fioweb/public dir to make the changes then build

