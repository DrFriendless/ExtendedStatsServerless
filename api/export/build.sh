
mkdir dist
rm dist/*
tsc
cp package.json ./dist
cd dist
npm pack
cp *.tgz ~/projects/repo
mv *.tgz ..