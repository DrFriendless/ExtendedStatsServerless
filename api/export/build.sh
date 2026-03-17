
rm tsconfig.tsbuildinfo
rm -rf dist
mkdir dist
tsc --build
cp package.json ./dist
cd dist
npm pack
cp *.tgz ~/projects/repo
mv *.tgz ..