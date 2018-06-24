const fs = require('fs-extra');
const concat = require('concat');

(async function build() {
  const files = [
    './dist/userCollection/runtime.js',
    './dist/userCollection/polyfills.js',
    './dist/userCollection/main.js'
  ];

  await fs.ensureDir('../static/userCollection');

  await concat(files, '../static/userCollection/user-collection.js');

  await fs.copyFile('./dist/userCollection/styles.css', '../static/userCollection/styles.css');

  // await fs.copy('./dist/elements/assets/', 'elements/assets/' );

})();
