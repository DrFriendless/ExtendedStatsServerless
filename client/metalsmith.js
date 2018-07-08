var Metalsmith  = require('metalsmith');
// var collections = require('metalsmith-collections');
// var layouts     = require('metalsmith-layouts');
// var markdown    = require('metalsmith-markdown');
// var permalinks  = require('metalsmith-permalinks');


Metalsmith(__dirname)         // __dirname defined by node.js - name of current working directory
    .metadata({                 // add any variable you want
        // use them in layout-files
        sitename: "My Static Site & Blog",
        siteurl: "http://example.com/",
        description: "It's about saying »Hello« to the world.",
        generatorname: "Metalsmith",
        generatorurl: "http://metalsmith.io/"
    })
    .source('./src')            // source directory
    .destination('./static')     // destination directory
    .clean(false)                // don't clean destination before
    .build(function(err) {      // build process
        if (err) throw err;       // error handling is required
    });